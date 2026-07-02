package com.bizkart.service;

import com.bizkart.model.Customer;
import com.bizkart.model.Order;
import com.bizkart.model.OrderItem;
import com.bizkart.model.Product;
import com.bizkart.model.Shop;
import com.bizkart.model.User;
import com.bizkart.repository.OrderItemRepository;
import com.bizkart.repository.OrderRepository;
import com.bizkart.repository.ProductRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final CurrentUserService currentUserService;
    private final CustomerService customerService;

    public OrderService(
        OrderRepository orderRepository,
        OrderItemRepository orderItemRepository,
        ProductRepository productRepository,
        CurrentUserService currentUserService,
        CustomerService customerService
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.productRepository = productRepository;
        this.currentUserService = currentUserService;
        this.customerService = customerService;
    }

    public record CreateOrderRequest(
        String customerName,
        String customerPhone,
        Order.PaymentMethod paymentMethod,
        BigDecimal amountPaid,
        String upiTransactionId,
        String cardLast4,
        String cardType,
        List<CartItem> items
    ) {}

    public record CartItem(Long productId, Integer quantity) {}

    @Transactional
    public Order createOrder(Authentication authentication, CreateOrderRequest request) {
        User currentUser = currentUserService.requireUser(authentication);
        Shop shop = currentUserService.requireShop(currentUser);

        if (request.items() == null || request.items().isEmpty()) {
            throw new RuntimeException("Add at least one product to the cart");
        }

        Order.PaymentMethod paymentMethod = request.paymentMethod() == null ? Order.PaymentMethod.CASH : request.paymentMethod();
        boolean creditSale = paymentMethod == Order.PaymentMethod.CREDIT;
        if (creditSale && isBlank(request.customerName())) {
            throw new RuntimeException("Customer name is required for credit sales");
        }
        if (creditSale && isBlank(request.customerPhone())) {
            throw new RuntimeException("Mobile number is required for credit sales");
        }

        Order order = new Order();
        order.setOrderNumber("ORD-" + shop.getCode().toUpperCase() + "-" + System.currentTimeMillis());
        order.setShop(shop);
        order.setSoldBy(currentUser);
        order.setCustomerName(defaultCustomerName(request.customerName()));
        order.setCustomerPhone(blankToNull(request.customerPhone()));
        order.setPaymentMethod(paymentMethod);
        order.setStatus(Order.OrderStatus.COMPLETED);
        order.setUpiTransactionId(blankToNull(request.upiTransactionId()));
        order.setCardLast4(blankToNull(request.cardLast4()));
        order.setCardType(blankToNull(request.cardType()));
        order.setTotalAmount(BigDecimal.ZERO);

        Order savedOrder = orderRepository.save(order);
        List<OrderItem> orderItems = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;

        for (CartItem cartItem : request.items()) {
            Product product = productRepository.findByIdAndShopId(cartItem.productId(), shop.getId())
                .orElseThrow(() -> new RuntimeException("Product not found: " + cartItem.productId()));

            if (cartItem.quantity() == null || cartItem.quantity() <= 0) {
                throw new RuntimeException("Quantity must be greater than zero");
            }

            if (product.getStock() < cartItem.quantity()) {
                throw new RuntimeException("Insufficient stock for: " + product.getName());
            }

            OrderItem item = new OrderItem();
            item.setOrder(savedOrder);
            item.setProduct(product);
            item.setQuantity(cartItem.quantity());
            item.setUnitPrice(product.getPrice());
            BigDecimal subtotal = product.getPrice().multiply(BigDecimal.valueOf(cartItem.quantity()));
            item.setSubtotal(subtotal);
            total = total.add(subtotal);

            BigDecimal purchasePrice = product.getPurchasePrice() == null ? BigDecimal.ZERO : product.getPurchasePrice();
            totalCost = totalCost.add(purchasePrice.multiply(BigDecimal.valueOf(cartItem.quantity())));

            product.setStock(product.getStock() - cartItem.quantity());
            productRepository.save(product);
            orderItems.add(orderItemRepository.save(item));
        }

        BigDecimal requestedPaidAmount = request.amountPaid() == null ? null : request.amountPaid().max(BigDecimal.ZERO);
        BigDecimal amountPaid;
        if (creditSale) {
            amountPaid = requestedPaidAmount == null ? BigDecimal.ZERO : requestedPaidAmount.min(total);
        } else {
            if (requestedPaidAmount != null && requestedPaidAmount.compareTo(total) < 0) {
                throw new RuntimeException("Use credit payment method when payment is less than bill total");
            }
            amountPaid = total;
        }

        BigDecimal balanceDue = total.subtract(amountPaid);
        Order.PaymentStatus paymentStatus = balanceDue.compareTo(BigDecimal.ZERO) == 0
            ? Order.PaymentStatus.PAID
            : amountPaid.compareTo(BigDecimal.ZERO) > 0 ? Order.PaymentStatus.PARTIAL : Order.PaymentStatus.DUE;

        Customer customer = null;
        if (creditSale || !isBlank(request.customerName()) || !isBlank(request.customerPhone())) {
            customer = customerService.findOrCreateCustomer(shop, defaultCustomerName(request.customerName()), request.customerPhone());
        }

        savedOrder.setCustomer(customer);
        savedOrder.setCustomerName(defaultCustomerName(request.customerName()));
        savedOrder.setCustomerPhone(blankToNull(request.customerPhone()));
        savedOrder.setTotalAmount(total);
        savedOrder.setAmountPaid(amountPaid);
        savedOrder.setBalanceDue(balanceDue);
        savedOrder.setTotalCost(totalCost);
        savedOrder.setGrossProfit(total.subtract(totalCost));
        savedOrder.setPaymentStatus(paymentStatus);
        savedOrder.setItems(orderItems);

        Order completedOrder = orderRepository.save(savedOrder);

        if (balanceDue.compareTo(BigDecimal.ZERO) > 0) {
            if (customer == null) {
                throw new RuntimeException("Customer is required for outstanding balances");
            }
            customerService.recordCreditSale(customer, completedOrder, currentUser, balanceDue);
        }

        return completedOrder;
    }

    public List<Order> getAllOrders(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            return orderRepository.findAll().stream()
                .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
                .toList();
        }
        return orderRepository.findByShopIdOrderByCreatedAtDesc(currentUserService.requireShop(user).getId());
    }

    public List<Order> getTodaysOrders(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            return orderRepository.findTodaysOrders();
        }
        return orderRepository.findTodaysOrdersByShopId(currentUserService.requireShop(user).getId());
    }

    public Optional<Order> getOrderById(Authentication authentication, Long id) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            return orderRepository.findById(id);
        }
        return orderRepository.findByIdAndShopId(id, currentUserService.requireShop(user).getId());
    }

    public Map<String, Object> getDashboardStats(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (!currentUserService.canViewBusinessInsights(user)) {
            throw new RuntimeException("Platform admin cannot view business dashboard data");
        }
        List<Order> allOrders = currentUserService.isSuperAdmin(user)
            ? orderRepository.findCompletedOrders()
            : orderRepository.findCompletedOrdersByShopId(currentUserService.requireShop(user).getId());
        List<Order> todaysOrders = currentUserService.isSuperAdmin(user)
            ? orderRepository.findTodaysOrders()
            : orderRepository.findTodaysOrdersByShopId(currentUserService.requireShop(user).getId());
        Map<String, Object> customerSummary = customerService.getCustomerSummary(authentication);

        BigDecimal totalRevenue = sum(allOrders, Order::getTotalAmount);
        BigDecimal todayRevenue = todaysOrders.stream()
            .filter(o -> o.getStatus() == Order.OrderStatus.COMPLETED)
            .map(Order::getTotalAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalProfit = sum(allOrders, Order::getGrossProfit);
        BigDecimal totalOutstanding = decimalValue(customerSummary.get("totalOutstanding"));

        Map<String, Long> paymentMethodCount = new HashMap<>();
        for (Order order : allOrders) {
            String method = order.getPaymentMethod().name();
            paymentMethodCount.merge(method, 1L, Long::sum);
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalOrders", allOrders.size());
        stats.put("todayOrders", todaysOrders.size());
        stats.put("totalRevenue", totalRevenue);
        stats.put("todayRevenue", todayRevenue);
        stats.put("paymentMethodStats", paymentMethodCount);
        stats.put("totalProfit", totalProfit);
        stats.put("todayProfit", sum(todaysOrders, Order::getGrossProfit));
        stats.put("totalOutstanding", totalOutstanding);
        stats.put("creditOrders", allOrders.stream().filter(order -> order.getBalanceDue().compareTo(BigDecimal.ZERO) > 0).count());
        stats.put("activeShopName", currentUserService.isSuperAdmin(user) ? "All Businesses" : currentUserService.requireShop(user).getName());
        stats.put("businessType", currentUserService.isSuperAdmin(user) ? "Platform" : currentUserService.requireShop(user).getBusinessType());
        return stats;
    }

    public Map<String, Object> getProfitAndLoss(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (!currentUserService.canViewBusinessInsights(user)) {
            throw new RuntimeException("Platform admin cannot view business report data");
        }
        List<Order> orders = currentUserService.isSuperAdmin(user)
            ? orderRepository.findCompletedOrders()
            : orderRepository.findCompletedOrdersByShopId(currentUserService.requireShop(user).getId());
        Map<String, Object> customerSummary = customerService.getCustomerSummary(authentication);

        BigDecimal revenue = sum(orders, Order::getTotalAmount);
        BigDecimal collections = sum(orders, Order::getAmountPaid).add(decimalValue(customerSummary.get("totalCreditRecovered")));
        BigDecimal outstanding = decimalValue(customerSummary.get("totalOutstanding"));
        BigDecimal cogs = sum(orders, Order::getTotalCost);
        BigDecimal grossProfit = sum(orders, Order::getGrossProfit);

        Map<String, Object> pnl = new LinkedHashMap<>();
        pnl.put("revenue", revenue);
        pnl.put("collections", collections);
        pnl.put("outstandingCredit", outstanding);
        pnl.put("costOfGoodsSold", cogs);
        pnl.put("grossProfit", grossProfit);
        pnl.put("grossMarginPercent", revenue.compareTo(BigDecimal.ZERO) == 0
            ? BigDecimal.ZERO
            : grossProfit.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, java.math.RoundingMode.HALF_UP));
        return pnl;
    }

    public List<Map<String, Object>> getTopSellingProducts(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (!currentUserService.canViewBusinessInsights(user)) {
            throw new RuntimeException("Platform admin cannot view business report data");
        }
        List<Object[]> results = currentUserService.isSuperAdmin(user)
            ? orderItemRepository.findTopSellingProducts()
            : orderItemRepository.findTopSellingProductsByShopId(currentUserService.requireShop(user).getId());
        return mapSalesResults(results, true);
    }

    public List<Map<String, Object>> getSalesByCategory(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (!currentUserService.canViewBusinessInsights(user)) {
            throw new RuntimeException("Platform admin cannot view business report data");
        }
        List<Object[]> results = currentUserService.isSuperAdmin(user)
            ? orderItemRepository.findSalesByCategory()
            : orderItemRepository.findSalesByCategoryByShopId(currentUserService.requireShop(user).getId());
        return mapSalesResults(results, false);
    }

    public List<Map<String, Object>> getDailyRevenue(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (!currentUserService.canViewBusinessInsights(user)) {
            throw new RuntimeException("Platform admin cannot view business report data");
        }
        List<Order> orders = currentUserService.isSuperAdmin(user)
            ? orderRepository.findCompletedOrders()
            : orderRepository.findCompletedOrdersByShopId(currentUserService.requireShop(user).getId());
        Map<LocalDate, BigDecimal> dailyMap = new TreeMap<>();
        for (Order order : orders) {
            LocalDate date = order.getCreatedAt().toLocalDate();
            dailyMap.merge(date, order.getTotalAmount(), BigDecimal::add);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        dailyMap.forEach((date, revenue) -> {
            Map<String, Object> item = new HashMap<>();
            item.put("date", date.toString());
            item.put("revenue", revenue);
            result.add(item);
        });
        return result;
    }

    private List<Map<String, Object>> mapSalesResults(List<Object[]> results, boolean includeProductColumns) {
        List<Map<String, Object>> mapped = new ArrayList<>();
        for (Object[] row : results) {
            Map<String, Object> item = new HashMap<>();
            if (includeProductColumns) {
                item.put("productId", row[0]);
                item.put("productName", row[1]);
                item.put("category", row[2]);
                item.put("totalQuantity", row[3]);
                item.put("totalRevenue", row[4]);
            } else {
                item.put("category", row[0]);
                item.put("totalQuantity", row[1]);
                item.put("totalRevenue", row[2]);
            }
            mapped.add(item);
        }
        return mapped;
    }

    private BigDecimal sum(List<Order> orders, java.util.function.Function<Order, BigDecimal> mapper) {
        return orders.stream()
            .map(mapper)
            .map(value -> value == null ? BigDecimal.ZERO : value)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String defaultCustomerName(String value) {
        return isBlank(value) ? "Walk-in Customer" : value.trim();
    }

    private BigDecimal decimalValue(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        return BigDecimal.ZERO;
    }

    private String blankToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
