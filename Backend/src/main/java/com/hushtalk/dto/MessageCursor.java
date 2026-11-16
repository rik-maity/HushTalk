package com.hushtalk.dto;

import java.time.LocalDateTime;

public class MessageCursor {

    private final LocalDateTime createdAt;
    private final Long messageId;

    public MessageCursor(
            LocalDateTime createdAt,
            Long messageId
    ) {
        this.createdAt = createdAt;
        this.messageId = messageId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public Long getMessageId() {
        return messageId;
    }
}