
package com.hushtalk.dto;

import java.time.Instant;

public class TypingEvent {

    private final Long conversationId;
    private final Long userId;
    private final boolean typing;
    private final Instant sentAt;

    public TypingEvent(
            Long conversationId,
            Long userId,
            boolean typing,
            Instant sentAt
    ) {
        this.conversationId = conversationId;
        this.userId = userId;
        this.typing = typing;
        this.sentAt = sentAt;
    }

    public Long getConversationId() {
        return conversationId;
    }

    public Long getUserId() {
        return userId;
    }

    public boolean isTyping() {
        return typing;
    }

    public Instant getSentAt() {
        return sentAt;
    }
}
