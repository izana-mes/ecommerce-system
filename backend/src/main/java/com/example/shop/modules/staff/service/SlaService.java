package com.example.shop.modules.staff.service;

import com.example.shop.modules.staff.dto.SlaOrderDto;

import java.util.List;

public interface SlaService {
    List<SlaOrderDto> getLateOrders();
    List<SlaOrderDto> getNearLateOrders(int thresholdMinutes);
}
