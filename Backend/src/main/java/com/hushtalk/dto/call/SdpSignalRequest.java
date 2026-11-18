package com.hushtalk.dto.call;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SdpSignalRequest(

        @NotBlank
        @Size(
                max = 65536,
                message = "SDP must not exceed 64 KB"
        )
        String sdp

) {
}