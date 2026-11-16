
package com.hushtalk.dto;

import java.time.LocalDateTime;

public class ReactionResponse {

    private final Long id;
    private final Long conversationId;
    private final Long messageId;
    private final Long userId;
    private final String type;
    private final LocalDateTime createdAt;

    public ReactionResponse(
            Long id,
            Long conversationId,
            Long messageId,
            Long userId,
            String type,
            LocalDateTime createdAt
    ) {
        this.id = id;
        this.conversationId = conversationId;
        this.messageId = messageId;
        this.userId = userId;
        this.type = type;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Long getConversationId() {
        return conversationId;
    }

    public Long getMessageId() {
        return messageId;
    }

    public Long getUserId() {
        return userId;
    }

    public String getType() {
        return type;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
