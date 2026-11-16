
package com.hushtalk.dto;

import java.time.LocalDateTime;

public class ReactionEvent {

    private final String action;
    private final ReactionResponse reaction;

    public ReactionEvent(
            String action,
            ReactionResponse reaction
    ) {
        this.action = action;
        this.reaction = reaction;
    }

    public String getAction() {
        return action;
    }

    public ReactionResponse getReaction() {
        return reaction;
    }
}
