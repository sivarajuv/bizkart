package com.bizkart.service;

import com.bizkart.model.Product;
import com.bizkart.model.ProductTranslation;
import com.bizkart.model.Shop;
import com.bizkart.model.User;
import com.bizkart.repository.ProductRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final CurrentUserService currentUserService;
    private final ShopService shopService;

    public ProductService(ProductRepository productRepository, CurrentUserService currentUserService, ShopService shopService) {
        this.productRepository = productRepository;
        this.currentUserService = currentUserService;
        this.shopService = shopService;
    }

    public record TranslationRequest(String languageCode, String displayName, String description) {}

    public record ProductRequest(
        Long shopId,
        String name,
        String sku,
        String category,
        String brand,
        String barcode,
        String packSize,
        BigDecimal price,
        BigDecimal mrp,
        BigDecimal purchasePrice,
        Integer stock,
        Integer minStockLevel,
        String unit,
        String imageUrl,
        String description,
        Boolean active,
        Boolean featured,
        Boolean taxable,
        Integer gstRate,
        String hsnCode,
        List<TranslationRequest> translations
    ) {}

    public List<Product> getAllProducts(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            return productRepository.findAll().stream()
                .sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName()))
                .toList();
        }
        return productRepository.findByShopIdOrderByNameAsc(currentUserService.requireShop(user).getId());
    }

    public Optional<Product> getProductById(Authentication authentication, Long id) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            return productRepository.findById(id);
        }
        return productRepository.findByIdAndShopId(id, currentUserService.requireShop(user).getId());
    }

    public List<Product> getProductsByCategory(Authentication authentication, String category) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            return productRepository.findAll().stream()
                .filter(product -> category.equals(product.getCategory()))
                .sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName()))
                .toList();
        }
        return productRepository.findByShopIdAndCategoryOrderByNameAsc(currentUserService.requireShop(user).getId(), category);
    }

    public List<Product> searchProducts(Authentication authentication, String name) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            return productRepository.findAll().stream()
                .filter(product -> product.getName().toLowerCase().contains(name.toLowerCase()))
                .sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName()))
                .toList();
        }
        return productRepository.findByShopIdAndNameContainingIgnoreCaseOrderByNameAsc(currentUserService.requireShop(user).getId(), name);
    }

    public List<String> getAllCategories(Authentication authentication) {
        User user = currentUserService.requireUser(authentication);
        if (currentUserService.isSuperAdmin(user)) {
            return productRepository.findAllCategories();
        }
        return productRepository.findCategoriesByShopId(currentUserService.requireShop(user).getId());
    }

    public Product createProduct(Authentication authentication, ProductRequest request) {
        User user = currentUserService.requireUser(authentication);
        Shop shop = resolveTargetShop(user, request.shopId());
        Product product = new Product();
        product.setShop(shop);
        applyRequest(product, request);
        return productRepository.save(product);
    }

    public Product updateProduct(Authentication authentication, Long id, ProductRequest updatedProduct) {
        Product product = getWritableProduct(authentication, id);
        applyRequest(product, updatedProduct);
        return productRepository.save(product);
    }

    public Product updatePrice(Authentication authentication, Long id, BigDecimal newPrice) {
        Product product = getWritableProduct(authentication, id);
        product.setPrice(newPrice);
        return productRepository.save(product);
    }

    public Product updateStock(Authentication authentication, Long id, Integer newStock) {
        Product product = getWritableProduct(authentication, id);
        product.setStock(newStock);
        return productRepository.save(product);
    }

    public void deleteProduct(Authentication authentication, Long id) {
        Product product = getWritableProduct(authentication, id);
        productRepository.delete(product);
    }

    public void initializeDefaultCatalogForShop(Shop shop) {
        if (!productRepository.findByShopIdOrderByNameAsc(shop.getId()).isEmpty()) {
            return;
        }
        String businessType = shop.getBusinessType() == null ? "" : shop.getBusinessType().toLowerCase();
        if (businessType.contains("cement") || businessType.contains("construction")) {
            seedCatalog(shop, cementCatalog());
            return;
        }
        if (businessType.contains("steel") || businessType.contains("tmt")) {
            seedCatalog(shop, steelCatalog());
            return;
        }
        if (businessType.contains("hardware")) {
            seedCatalog(shop, hardwareCatalog());
            return;
        }
        if (!businessType.isBlank() && !businessType.contains("kirana") && !businessType.contains("grocery")) {
            return;
        }

        List<ProductRequest> catalog = List.of(
            product("Basmati Rice", "GRAINS-RICE-001", "Grains & Staples", "India Gate", "5kg", 425, 450, 300, 75, 10, "bag",
                tr("hi", "बासमती चावल", "प्रीमियम लंबे दाने वाला चावल"),
                tr("te", "బాస్మతి బియ్యం", "ప్రీమియం పొడవాటి గింజల బియ్యం"),
                tr("ta", "பாஸ்மதி அரிசி", "நீளமான மணமுள்ள அரிசி")),
            product("Wheat Flour Atta", "GRAINS-ATTA-002", "Grains & Staples", "Aashirvaad", "10kg", 470, 495, 350, 55, 12, "bag",
                tr("hi", "गेहूं आटा", "रोजाना रोटी के लिए"),
                tr("te", "గోధుమ పిండి", "రోజువారీ చపాతీల కోసం")),
            product("Toor Dal", "PULSE-TOOR-003", "Pulses & Lentils", "24 Mantra", "1kg", 155, 165, 120, 48, 8, "kg",
                tr("hi", "तूर दाल", "घर की दाल के लिए"),
                tr("te", "కందిపప్పు", "ఇంటివంటల కోసం")),
            product("Moong Dal", "PULSE-MOONG-004", "Pulses & Lentils", "Tata Sampann", "1kg", 138, 145, 112, 36, 8, "kg",
                tr("hi", "मूंग दाल", "हल्की और पौष्टिक"),
                tr("te", "పెసర పప్పు", "తేలికగా జీర్ణమయ్యేది")),
            product("Chana Dal", "PULSE-CHANA-005", "Pulses & Lentils", "Fortune", "1kg", 98, 105, 80, 34, 8, "kg",
                tr("hi", "चना दाल", "रोजाना उपयोग"),
                tr("te", "సెనగ పప్పు", "రోజువారీ వినియోగం")),
            product("Sugar", "STAPLE-SUGAR-006", "Grains & Staples", "Madhur", "1kg", 48, 52, 38, 60, 10, "kg",
                tr("hi", "चीनी", "शुद्ध सफेद चीनी"),
                tr("te", "చక్కెర", "శుద్ధమైన తెల్ల చక్కెర")),
            product("Iodized Salt", "STAPLE-SALT-007", "Grains & Staples", "Tata Salt", "1kg", 24, 28, 18, 80, 10, "kg",
                tr("hi", "आयोडीन नमक", "रोजाना इस्तेमाल के लिए"),
                tr("te", "ఐయోడిన్ ఉప్పు", "రోజువారీ వంటకు")),
            product("Sunflower Oil", "OIL-SUN-008", "Oils & Ghee", "Fortune", "1L", 172, 178, 150, 65, 8, "litre",
                tr("hi", "सनफ्लावर ऑयल", "हल्का कुकिंग ऑयल"),
                tr("te", "సన్‌ఫ్లవర్ ఆయిల్", "తేలికపాటి వంటనూనె")),
            product("Groundnut Oil", "OIL-GROUND-009", "Oils & Ghee", "Dhara", "1L", 196, 205, 175, 42, 8, "litre",
                tr("hi", "मूंगफली तेल", "गहरे स्वाद के लिए"),
                tr("te", "వేరుశెనగ నూనె", "సువాసన గల వంటనూనె")),
            product("Cow Ghee", "GHEE-001", "Oils & Ghee", "Nandini", "1L", 625, 650, 545, 20, 4, "litre",
                tr("hi", "देसी घी", "शुद्ध घी"),
                tr("te", "నెయ్యి", "శుద్ధమైన నెయ్యి")),
            product("Turmeric Powder", "SPICE-TUR-010", "Spices", "Everest", "200g", 56, 60, 42, 32, 6, "packet",
                tr("hi", "हल्दी पाउडर", "खुशबूदार हल्दी"),
                tr("te", "పసుపు పొడి", "సువాసన గల పసుపు")),
            product("Red Chilli Powder", "SPICE-CHILLI-011", "Spices", "Aachi", "200g", 72, 78, 55, 28, 6, "packet",
                tr("hi", "लाल मिर्च पाउडर", "तेज स्वाद"),
                tr("te", "కారం పొడి", "కారం రుచి కోసం")),
            product("Coriander Powder", "SPICE-DHANIA-012", "Spices", "Catch", "200g", 48, 52, 37, 26, 6, "packet",
                tr("hi", "धनिया पाउडर", "ताजी खुशबू"),
                tr("te", "ధనియా పొడి", "తాజా వాసన")),
            product("Garam Masala", "SPICE-GM-013", "Spices", "MDH", "100g", 64, 70, 48, 18, 6, "packet",
                tr("hi", "गरम मसाला", "मिक्स मसाला"),
                tr("te", "గరం మసాలా", "మిక్స్ మసాలా")),
            product("Tea Powder", "BEV-TEA-014", "Beverages", "Taj Mahal", "500g", 285, 295, 220, 22, 5, "packet",
                tr("hi", "चाय पत्ती", "मजबूत स्वाद वाली चाय"),
                tr("te", "టీ పొడి", "గట్టి రుచి కల టీ")),
            product("Coffee Powder", "BEV-COFFEE-015", "Beverages", "Bru", "200g", 168, 175, 140, 18, 5, "packet",
                tr("hi", "कॉफी पाउडर", "सुगंधित कॉफी"),
                tr("te", "కాఫీ పొడి", "సువాసన గల కాఫీ")),
            product("Milk", "DAIRY-MILK-016", "Dairy & Eggs", "Amul", "1L", 62, 64, 54, 90, 15, "litre",
                tr("hi", "दूध", "फुल क्रीम दूध"),
                tr("te", "పాలు", "ఫుల్ క్రీమ్ పాలు")),
            product("Curd", "DAIRY-CURD-017", "Dairy & Eggs", "Heritage", "500g", 38, 40, 30, 42, 8, "cup",
                tr("hi", "दही", "ताज़ा दही"),
                tr("te", "పెరుగు", "తాజా పెరుగు")),
            product("Paneer", "DAIRY-PANEER-018", "Dairy & Eggs", "Milky Mist", "200g", 92, 98, 75, 20, 5, "packet",
                tr("hi", "पनीर", "ताज़ा पनीर"),
                tr("te", "పనీర్", "తాజా పనీర్")),
            product("Eggs", "DAIRY-EGG-019", "Dairy & Eggs", "Farm Fresh", "30 pcs", 210, 220, 180, 45, 10, "tray",
                tr("hi", "अंडे", "फार्म फ्रेश अंडे"),
                tr("te", "గుడ్లు", "తాజా గుడ్లు")),
            product("Tomato", "VEG-TOMATO-020", "Vegetables", "Local", "1kg", 42, 48, 25, 60, 10, "kg",
                tr("hi", "टमाटर", "ताज़े लाल टमाटर"),
                tr("te", "టమాటా", "తాజా ఎర్ర టమాటాలు")),
            product("Onion", "VEG-ONION-021", "Vegetables", "Local", "1kg", 36, 40, 22, 85, 12, "kg",
                tr("hi", "प्याज", "ताज़ा प्याज"),
                tr("te", "ఉల్లిపాయలు", "తాజా ఉల్లిపాయలు")),
            product("Potato", "VEG-POTATO-022", "Vegetables", "Local", "1kg", 34, 38, 20, 90, 12, "kg",
                tr("hi", "आलू", "ताज़े आलू"),
                tr("te", "బంగాళదుంపలు", "తాజా బంగాళదుంపలు")),
            product("Ginger", "VEG-GINGER-023", "Vegetables", "Local", "250g", 28, 32, 18, 25, 4, "packet",
                tr("hi", "अदरक", "ताज़ा अदरक"),
                tr("te", "అల్లం", "తాజా అల్లం")),
            product("Garlic", "VEG-GARLIC-024", "Vegetables", "Local", "250g", 34, 38, 24, 25, 4, "packet",
                tr("hi", "लहसुन", "ताज़ा लहसुन"),
                tr("te", "వెల్లులి", "తాజా వెల్లుల్లి")),
            product("Banana", "FRUIT-BANANA-025", "Fruits", "Local", "1 dozen", 58, 64, 40, 35, 6, "dozen",
                tr("hi", "केला", "मीठे केले"),
                tr("te", "అరటిపండ్లు", "తీపి అరటిపండ్లు")),
            product("Apple", "FRUIT-APPLE-026", "Fruits", "Washington", "1kg", 165, 180, 140, 26, 5, "kg",
                tr("hi", "सेब", "कुरकुरे सेब"),
                tr("te", "యాపిల్స్", "కరకరలాడే యాపిల్స్")),
            product("Mango", "FRUIT-MANGO-027", "Fruits", "Local", "1kg", 125, 140, 90, 24, 5, "kg",
                tr("hi", "आम", "मौसमी आम"),
                tr("te", "మామిడి", "సీజనల్ మామిడిపండ్లు")),
            product("Bread", "BAKERY-BREAD-028", "Bakery", "Britannia", "400g", 38, 40, 28, 32, 6, "loaf",
                tr("hi", "ब्रेड", "सॉफ्ट ब्रेड"),
                tr("te", "బ్రెడ్", "సాఫ్ట్ బ్రెడ్")),
            product("Rusk", "BAKERY-RUSK-029", "Bakery", "Sunfeast", "300g", 42, 46, 30, 18, 4, "packet",
                tr("hi", "रस्क", "चाय के साथ"),
                tr("te", "రస్క్", "టీతో తినడానికి")),
            product("Parle-G Biscuits", "SNACK-BISCUIT-030", "Snacks", "Parle", "800g", 98, 105, 78, 36, 8, "packet",
                tr("hi", "पारले-जी बिस्किट", "क्लासिक ग्लूकोज बिस्किट"),
                tr("te", "పార్లే-జీ బిస్కెట్లు", "క్లాసిక్ గ్లూకోజ్ బిస్కెట్లు")),
            product("Mixture", "SNACK-MIX-031", "Snacks", "Haldiram", "400g", 88, 95, 68, 20, 4, "packet",
                tr("hi", "मिक्सचर", "मसालेदार नमकीन"),
                tr("te", "మిక్చర్", "కారం నంకీన్")),
            product("Poha", "STAPLE-POHA-032", "Grains & Staples", "Local", "1kg", 62, 68, 45, 18, 4, "kg",
                tr("hi", "पोहा", "हल्का नाश्ता"),
                tr("te", "అటుకులు", "తేలికైన అల్పాహారం")),
            product("Rava", "STAPLE-RAVA-033", "Grains & Staples", "Local", "1kg", 48, 52, 36, 24, 5, "kg",
                tr("hi", "सूजी", "उपमा और हलवा के लिए"),
                tr("te", "రవ్వ", "ఉప్మా కోసం")),
            product("Jaggery", "STAPLE-JAGGERY-034", "Grains & Staples", "Organic", "1kg", 72, 78, 58, 22, 5, "kg",
                tr("hi", "गुड़", "देसी गुड़"),
                tr("te", "బెల్లం", "దేశీ బెల్లం")),
            product("Bath Soap", "HOME-SOAP-035", "Home & Personal Care", "Dove", "4 pcs", 158, 168, 132, 20, 4, "box",
                tr("hi", "नहाने का साबुन", "रोजाना उपयोग"),
                tr("te", "స్నాన సబ్బు", "రోజువారీ వినియోగం")),
            product("Detergent Powder", "HOME-DETERGENT-036", "Home & Personal Care", "Surf Excel", "1kg", 128, 138, 108, 28, 5, "packet",
                tr("hi", "डिटर्जेंट पाउडर", "कपड़े धोने के लिए"),
                tr("te", "డిటర్జెంట్ పొడి", "బట్టలు ఉతికేందుకు")),
            product("Dishwash Liquid", "HOME-DISH-037", "Home & Personal Care", "Vim", "500ml", 92, 98, 76, 16, 4, "bottle",
                tr("hi", "डिशवॉश लिक्विड", "बर्तन साफ करने के लिए"),
                tr("te", "డిష్‌వాష్ లిక్విడ్", "పాత్రలు శుభ్రం చేయడానికి")),
            product("Toothpaste", "CARE-TOOTH-038", "Home & Personal Care", "Colgate", "200g", 118, 125, 95, 22, 4, "tube",
                tr("hi", "टूथपेस्ट", "दैनिक दंत देखभाल"),
                tr("te", "టూత్‌పేస్ట్", "రోజువారీ దంత సంరక్షణ")),
            product("Shampoo", "CARE-SHAMPOO-039", "Home & Personal Care", "Clinic Plus", "340ml", 152, 160, 126, 14, 4, "bottle",
                tr("hi", "शैम्पू", "बालों की देखभाल"),
                tr("te", "షాంపూ", "జుట్టు సంరక్షణ")),
            product("UPI QR Stand", "POS-UPI-040", "POS Essentials", "Generic", "1 pc", 149, 159, 110, 4, 1, "piece",
                tr("hi", "यूपीआई क्यूआर स्टैंड", "काउंटर के लिए"),
                tr("te", "యూపీఐ క్యూ ఆర్ స్టాండ్", "కౌంటర్ కోసం"))
        );

        seedCatalog(shop, catalog);
    }

    private void seedCatalog(Shop shop, List<ProductRequest> catalog) {
        for (ProductRequest request : catalog) {
            Product product = new Product();
            product.setShop(shop);
            applyRequest(product, request);
            productRepository.save(product);
        }
    }

    private List<ProductRequest> cementCatalog() {
        return List.of(
            product("OPC Cement 53 Grade", "CEMENT-OPC-001", "Cement", "UltraTech", "50kg", 410, 425, 360, 160, 20, "bag"),
            product("PPC Cement", "CEMENT-PPC-002", "Cement", "Ramco", "50kg", 385, 400, 338, 140, 20, "bag"),
            product("White Cement", "CEMENT-WHITE-003", "Cement", "Birla White", "25kg", 760, 790, 690, 28, 6, "bag"),
            product("Wall Putty", "CEMENT-PUTTY-004", "Construction Materials", "JK", "40kg", 690, 725, 615, 36, 8, "bag"),
            product("Concrete Mix", "CEMENT-MIX-005", "Construction Materials", "ACC", "40kg", 340, 355, 295, 42, 8, "bag"),
            product("Sand Paper Pack", "HARD-SAND-006", "Hardware", "Generic", "10 pcs", 120, 135, 88, 20, 5, "packet")
        );
    }

    private List<ProductRequest> steelCatalog() {
        return List.of(
            product("TMT Bar 8mm", "STEEL-TMT-008", "Steel", "Vizag Steel", "12m", 515, 530, 470, 120, 20, "rod"),
            product("TMT Bar 10mm", "STEEL-TMT-010", "Steel", "Tata Tiscon", "12m", 790, 810, 725, 100, 15, "rod"),
            product("TMT Bar 12mm", "STEEL-TMT-012", "Steel", "JSW", "12m", 1110, 1145, 1020, 95, 12, "rod"),
            product("Binding Wire", "STEEL-BIND-013", "Steel", "Generic", "30kg", 2490, 2550, 2280, 24, 4, "bundle"),
            product("MS Angle 50x50", "STEEL-ANGLE-014", "Steel", "Jindal", "6m", 1380, 1410, 1260, 28, 4, "piece"),
            product("Welding Electrodes", "HARD-WELD-015", "Hardware", "Ador", "5kg", 480, 510, 425, 18, 4, "box")
        );
    }

    private List<ProductRequest> hardwareCatalog() {
        return List.of(
            product("PVC Pipe 1 inch", "HARD-PVC-001", "Hardware", "Astral", "3m", 180, 195, 152, 60, 10, "piece"),
            product("CPVC Elbow", "HARD-ELBOW-002", "Hardware", "Ashirvad", "1 pc", 42, 48, 32, 120, 20, "piece"),
            product("GI Wire Bundle", "HARD-GI-003", "Hardware", "Generic", "10kg", 920, 950, 835, 22, 4, "bundle"),
            product("Nails Assorted Pack", "HARD-NAIL-004", "Hardware", "Generic", "1kg", 92, 100, 68, 55, 10, "packet"),
            product("Door Hinges Set", "HARD-HINGE-005", "Hardware", "Ebco", "4 pcs", 210, 225, 165, 26, 5, "box"),
            product("Wall Paint Primer", "HARD-PRIMER-006", "Construction Materials", "Asian Paints", "4L", 630, 660, 570, 18, 4, "bucket")
        );
    }

    private Product getWritableProduct(Authentication authentication, Long id) {
        User user = currentUserService.requireUser(authentication);
        if (!currentUserService.canManageShop(user)) {
            throw new RuntimeException("Not allowed to manage products");
        }
        if (currentUserService.isSuperAdmin(user)) {
            return productRepository.findById(id).orElseThrow(() -> new RuntimeException("Product not found: " + id));
        }
        return productRepository.findByIdAndShopId(id, currentUserService.requireShop(user).getId())
            .orElseThrow(() -> new RuntimeException("Product not found: " + id));
    }

    private Shop resolveTargetShop(User user, Long requestedShopId) {
        if (currentUserService.isSuperAdmin(user)) {
            if (requestedShopId == null) {
                throw new RuntimeException("Shop is required");
            }
            return shopService.ensureActiveShop(requestedShopId);
        }
        return currentUserService.requireShop(user);
    }

    private void applyRequest(Product product, ProductRequest request) {
        product.setName(request.name());
        product.setSku(request.sku());
        product.setCategory(request.category());
        product.setBrand(request.brand());
        product.setBarcode(request.barcode());
        product.setPackSize(request.packSize());
        product.setPrice(request.price());
        product.setMrp(request.mrp());
        product.setPurchasePrice(request.purchasePrice());
        product.setStock(request.stock());
        product.setMinStockLevel(request.minStockLevel());
        product.setUnit(request.unit());
        product.setImageUrl(request.imageUrl());
        product.setDescription(request.description());
        product.setActive(request.active() == null || request.active());
        product.setFeatured(request.featured() != null && request.featured());
        product.setTaxable(request.taxable() == null || request.taxable());
        product.setGstRate(normalizeGstRate(request.gstRate()));
        product.setHsnCode(blankToNull(request.hsnCode()));

        List<ProductTranslation> translations = new ArrayList<>();
        if (request.translations() != null) {
            for (TranslationRequest translationRequest : request.translations()) {
                if (translationRequest == null || translationRequest.languageCode() == null || translationRequest.languageCode().isBlank()) {
                    continue;
                }
                ProductTranslation translation = new ProductTranslation();
                translation.setProduct(product);
                translation.setLanguageCode(translationRequest.languageCode());
                translation.setDisplayName(translationRequest.displayName());
                translation.setDescription(translationRequest.description());
                translations.add(translation);
            }
        }
        product.getTranslations().clear();
        product.getTranslations().addAll(translations);
    }

    private ProductRequest product(
        String name,
        String sku,
        String category,
        String brand,
        String packSize,
        double price,
        double mrp,
        double purchasePrice,
        int stock,
        int minStock,
        String unit,
        TranslationRequest... translations
    ) {
        return new ProductRequest(
            null,
            name,
            sku,
            category,
            brand,
            sku,
            packSize,
            BigDecimal.valueOf(price),
            BigDecimal.valueOf(mrp),
            BigDecimal.valueOf(purchasePrice),
            stock,
            minStock,
            unit,
            null,
            name + " - " + brand,
            true,
            false,
            true,
            null,
            null,
            List.of(translations)
        );
    }

    private TranslationRequest tr(String languageCode, String displayName, String description) {
        return new TranslationRequest(languageCode, displayName, description);
    }

    private Integer normalizeGstRate(Integer gstRate) {
        if (gstRate == null) {
            return null;
        }
        if (gstRate != 0 && gstRate != 5 && gstRate != 12 && gstRate != 18 && gstRate != 28) {
            throw new RuntimeException("GST rate must be one of 0, 5, 12, 18, or 28");
        }
        return gstRate;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
    // ── Portal: public product listing by shop ──────────────────────────────
    public java.util.List<Product> getProductsByShop(Long shopId) {
        return productRepository.findByShopIdOrderByNameAsc(shopId);
    }


}
