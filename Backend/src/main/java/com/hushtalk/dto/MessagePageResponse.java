package com.hushtalk.dto;

import java.util.List;

public class MessagePageResponse {

    private final List<MessageResponse> messages;
    private final String nextCursor;
    private final boolean hasMore;

    public MessagePageResponse(
            List<MessageResponse> messages,
            String nextCursor,
            boolean hasMore
    ) {
        this.messages = messages;
        this.nextCursor = nextCursor;
        this.hasMore = hasMore;
    }

    public List<MessageResponse> getMessages() {
        return messages;
    }

    public String getNextCursor() {
        return nextCursor;
    }

    public boolean isHasMore() {
        return hasMore;
    }
}