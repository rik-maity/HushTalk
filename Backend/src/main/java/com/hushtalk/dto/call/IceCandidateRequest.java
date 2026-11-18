package com.hushtalk.dto.call;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record IceCandidateRequest(

        @NotBlank
        @Size(max = 4096)
        String candidate,

        @Size(max = 256)
        String sdpMid,

        @NotNull
        Integer sdpMLineIndex

) {
}