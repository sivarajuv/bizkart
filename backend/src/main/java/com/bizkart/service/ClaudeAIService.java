package com.bizkart.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.*;

@Service
public class ClaudeAIService {

    @Value("${claude.api.key}")
    private String apiKey;

    @Value("${claude.api.url}")
    private String apiUrl;

    @Value("${claude.api.model}")
    private String model;

    private final WebClient webClient;

    public ClaudeAIService() {
        this.webClient = WebClient.builder().build();
    }

    public String askClaude(String userMessage, String systemContext) {
        try {
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", model);
            requestBody.put("max_tokens", 1024);

            Map<String, String> systemMsg = new HashMap<>();
            systemMsg.put("type", "text");
            systemMsg.put("text", systemContext);

            Map<String, Object> message = new HashMap<>();
            message.put("role", "user");
            message.put("content", userMessage);

            requestBody.put("system", systemContext);
            requestBody.put("messages", List.of(message));

            Map response = webClient.post()
                .uri(apiUrl)
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

            if (response != null && response.containsKey("content")) {
                List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
                if (!content.isEmpty()) {
                    return (String) content.get(0).get("text");
                }
            }
            return "Unable to get response from Claude AI.";
        } catch (Exception e) {
            return "Error connecting to Claude AI: " + e.getMessage();
        }
    }

    public String getPricingSuggestion(String productName, String category, double currentPrice, int stock) {
        String systemContext = """
            You are a grocery shop pricing expert. Analyze products and suggest optimal pricing strategies.
            Consider factors like season, demand, competition, and stock levels.
            Provide concise, actionable pricing recommendations in 2-3 sentences.
            """;

        String userMessage = String.format(
            "Product: %s, Category: %s, Current Price: ₹%.2f, Stock: %d units. " +
            "Should I change the price? If yes, what price do you recommend and why?",
            productName, category, currentPrice, stock
        );

        return askClaude(userMessage, systemContext);
    }

    public String getInventoryInsight(List<Map<String, Object>> salesData) {
        String systemContext = """
            You are a grocery inventory management expert. Analyze sales data and provide insights.
            Focus on identifying fast-moving items, slow movers, and restocking needs.
            Be concise and practical. Use bullet points for clarity.
            """;

        StringBuilder sb = new StringBuilder("Here is the current sales data for our grocery shop:\n");
        for (Map<String, Object> item : salesData) {
            sb.append(String.format("- %s: %s units sold, Revenue: ₹%s\n",
                item.get("productName"), item.get("totalQuantity"), item.get("totalRevenue")));
        }
        sb.append("\nProvide top 3 insights and recommendations.");

        return askClaude(sb.toString(), systemContext);
    }

    public String getChatResponse(String userMessage, String shopContext) {
        String systemContext = """
            You are a helpful AI assistant for BizKart multi-business management system.
            You help shop owners with:
            - Pricing strategies and recommendations
            - Inventory management tips
            - Sales analysis insights
            - Business growth suggestions
            - Customer service best practices
            
            Be concise, friendly, and practical. Format responses clearly.
            Shop context: """ + shopContext;

        return askClaude(userMessage, systemContext);
    }
}
