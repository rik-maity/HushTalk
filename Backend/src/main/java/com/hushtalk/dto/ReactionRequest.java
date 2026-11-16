
package com.hushtalk.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ReactionRequest {

    @NotBlank(message = "Reaction type is required")
    @Size(max = 30, message = "Reaction type is too long")
    private String type;

    public ReactionRequest() {
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
