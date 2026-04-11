package com.example.shop.modules.searchhistory.service;

import com.example.shop.modules.user.entity.User;

import java.util.List;

public interface SearchHistoryService {

    void saveSearchTerm(User user, String query);

    List<String> getHistory(User user, int limit);

    void clearHistory(User user);
}
