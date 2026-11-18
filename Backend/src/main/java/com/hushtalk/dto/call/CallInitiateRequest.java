package com.hushtalk.dto.call;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CallInitiateRequest(

        @NotNull
        Long conversationId,

        @NotNull
        Long targetUserId,

        @NotNull
        @Pattern(
                regexp = "(?i)AUDIO|VIDEO",
                message = "callType must be AUDIO or VIDEO"
        )
        String callType

) {
}