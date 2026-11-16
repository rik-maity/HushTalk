package com.hushtalk.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ConversationRequest {

    @NotBlank(message = "Conversation name is required")
    @Size(min = 1, max = 100,
            message = "Conversation name must be between 1 and 100 characters")
    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}