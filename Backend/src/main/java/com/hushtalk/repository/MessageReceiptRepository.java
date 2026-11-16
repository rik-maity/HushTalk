
package com.hushtalk.repository;

import com.hushtalk.entity.MessageReceipt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MessageReceiptRepository
        extends JpaRepository<MessageReceipt, Long> {

    Optional<MessageReceipt> findByMessageIdAndUserId(
            Long messageId,
            Long userId
    );

    List<MessageReceipt> findByMessageIdOrderByUserIdAsc(
            Long messageId
    );
}
