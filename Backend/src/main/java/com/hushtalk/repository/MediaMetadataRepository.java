package com.hushtalk.repository;

import com.hushtalk.entity.MediaMetadata;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MediaMetadataRepository
        extends JpaRepository<MediaMetadata, Long> {

    List<MediaMetadata> findByMessageId(
            Long messageId
    );
}