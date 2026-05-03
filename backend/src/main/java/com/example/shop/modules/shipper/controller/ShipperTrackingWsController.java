package com.example.shop.modules.shipper.controller;

import com.example.shop.modules.shipper.dto.ShipperDtos;
import com.example.shop.modules.shipper.service.ShipperRealtimeService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class ShipperTrackingWsController {

    private final ShipperRealtimeService shipperRealtimeService;

    @MessageMapping("/location.update")
    public void updateLocation(@Payload ShipperDtos.LocationUpdateRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            return;
        }
        shipperRealtimeService.updateLocation(user, request, "WS");
    }
}
