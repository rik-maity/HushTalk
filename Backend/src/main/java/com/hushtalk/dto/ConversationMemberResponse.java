package com.hushtalk.dto;

public class ConversationMemberResponse {

    private final Long id;
    private final String username;

    public ConversationMemberResponse(Long id, String username) {
        this.id = id;
        this.username = username;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }
}