
package com.hushtalk.controller;

import com.hushtalk.dto.ReactionRequest;
import com.hushtalk.dto.ReactionResponse;
import com.hushtalk.service.MessageReactionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/conversations")
public class MessageReactionController {

    private final MessageReactionService reactionService;

    public MessageReactionController(
            MessageReactionService reactionService
    ) {
        this.reactionService = reactionService;
    }

    @PostMapping("/{conversationId}/messages/{messageId}/reactions")
    public ReactionResponse addReaction(
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @Valid @RequestBody ReactionRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        return reactionService.addReaction(
                conversationId,
                messageId,
                request.getType(),
                userId
        );
    }

    @DeleteMapping("/{conversationId}/messages/{messageId}/reactions")
    public ResponseEntity<Void> removeReaction(
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @Valid @RequestBody ReactionRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        reactionService.removeReaction(
                conversationId,
                messageId,
                request.getType(),
                userId
        );

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{conversationId}/messages/{messageId}/reactions")
    public List<ReactionResponse> getReactions(
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @AuthenticationPrincipal Long userId
    ) {
        return reactionService.getReactions(
                conversationId,
                messageId,
                userId
        );
    }
}
