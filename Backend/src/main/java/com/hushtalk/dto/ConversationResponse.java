package com.hushtalk.dto;

public class ConversationResponse {

    private Long id;
    private String name;
    private Long createdBy;

    public ConversationResponse(Long id, String name, Long createdBy) {
        this.id = id;
        this.name = name;
        this.createdBy = createdBy;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Long getCreatedBy() {
        return createdBy;
    }
}