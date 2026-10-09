package com.esaengineering.security;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rate limiter for the auth endpoints, same numbers as server.js: 30 hits per
 * IP per 15 minutes on anything under /api/auth. Normal humans never get near
 * it, brute-force scripts hit 429 fast.
 *
 * In-memory on purpose - resets when the app restarts, which is fine at our
 * traffic. TODO: shared store (redis or similar) if we ever run >1 instance.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 15 * 60 * 1000L;
    private static final int MAX_HITS = 30;

    private static class Window {
        long start;
        int count;
        Window(long start) { this.start = start; }
    }

    private final ConcurrentHashMap<String, Window> hits = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri == null || !uri.startsWith("/api/auth");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String ip = request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
        long now = System.currentTimeMillis();
        Window w = hits.compute(ip, (key, existing) -> {
            if (existing == null || now - existing.start > WINDOW_MS) return new Window(now);
            return existing;
        });
        boolean over;
        synchronized (w) {
            w.count++;
            over = w.count > MAX_HITS;
        }
        if (over) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"message\":\"Too many attempts from here. Wait 15 minutes and try again.\",\"success\":false}");
            return;
        }
        chain.doFilter(request, response);
    }
}
