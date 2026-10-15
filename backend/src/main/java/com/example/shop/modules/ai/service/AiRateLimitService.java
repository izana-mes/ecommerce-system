package com.example.shop.modules.ai.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class AiRateLimitService {
    private final StringRedisTemplate redis; private final ConcurrentHashMap<String,AtomicInteger> local=new ConcurrentHashMap<>();
    public AiRateLimitService(org.springframework.beans.factory.ObjectProvider<StringRedisTemplate> p){redis=p.getIfAvailable();}
    public boolean allow(String key){String k="ai:rate:"+key; try {if(redis!=null){Long n=redis.opsForValue().increment(k);if(n!=null&&n==1)redis.expire(k,Duration.ofMinutes(1));return n!=null&&n<=20;}}catch(Exception ignored){} return local.computeIfAbsent(k,x->new AtomicInteger()).incrementAndGet()<=20;}
}
