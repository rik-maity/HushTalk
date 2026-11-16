
package com.hushtalk.controller;

import com.hushtalk.dto.AddMemberRequest;
import com.hushtalk.dto.ChangeMemberRoleRequest;
import com.hushtalk.dto.ConversationRequest;
import com.hushtalk.dto.ConversationResponse;
import com.hushtalk.service.ConversationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/conversations")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponse createConversation(
            @Valid @RequestBody ConversationRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        return conversationService.createConversation(request, userId);
    }

    @GetMapping
    public List<ConversationResponse> getAllConversations(
            @AuthenticationPrincipal Long userId
    ) {
        return conversationService.getAllConversations(userId);
    }

    @GetMapping("/{id}")
    public ConversationResponse getConversationById(
            @PathVariable Long id,
            @AuthenticationPrincipal Long userId
    ) {
        return conversationService.getConversationById(id, userId);
    }

    @PutMapping("/{id}")
    public ConversationResponse updateConversation(
            @PathVariable Long id,
            @Valid @RequestBody ConversationRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        return conversationService.updateConversation(
                id,
                request,
                userId
        );
    }

    @PostMapping("/{id}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public void addMember(
            @PathVariable Long id,
            @Valid @RequestBody AddMemberRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        conversationService.addMember(id, request, userId);
    }

    @DeleteMapping("/{id}/members/{targetUserId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(
            @PathVariable Long id,
            @PathVariable Long targetUserId,
            @AuthenticationPrincipal Long userId
    ) {
        conversationService.removeMember(
                id,
                targetUserId,
                userId
        );
    }

    @PutMapping("/{id}/members/{targetUserId}/role")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changeMemberRole(
            @PathVariable Long id,
            @PathVariable Long targetUserId,
            @Valid @RequestBody ChangeMemberRoleRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        conversationService.changeMemberRole(
                id,
                targetUserId,
                request,
                userId
        );
    }

    @DeleteMapping("/{id}/members/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leaveConversation(
            @PathVariable Long id,
            @AuthenticationPrincipal Long userId
    ) {
        conversationService.leaveConversation(id, userId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConversation(
            @PathVariable Long id,
            @AuthenticationPrincipal Long userId
    ) {
        conversationService.deleteConversation(id, userId);
    }
}
