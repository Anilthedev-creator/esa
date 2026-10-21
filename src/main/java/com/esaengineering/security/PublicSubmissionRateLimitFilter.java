package com.esaengineering.security;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** A small per-IP limit and body-size limit for public forms. */
@Component
public class PublicSubmissionRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 15 * 60 * 1000L;
    private static final int MAX_ENQUIRIES = 10;
    private static final int MAX_BOOKINGS = 15;
    private static final int MAX_BODY_BYTES = 5 * 1024 * 1024;

    private static class Window {
        long start;
        int count;
        Window(long start) { this.start = start; }
    }

    private final Map<String, Window> enquiries = new ConcurrentHashMap<>();
    private final Map<String, Window> bookings = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return true;
        String path = request.getRequestURI();
        return !"/api/enquiries".equals(path) && !"/api/bookings".equals(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > MAX_BODY_BYTES) {
            writeTooLarge(response);
            return;
        }

        boolean isEnquiry = "/api/enquiries".equals(request.getRequestURI());
        Map<String, Window> counters = isEnquiry ? enquiries : bookings;
        int maxHits = isEnquiry ? MAX_ENQUIRIES : MAX_BOOKINGS;
        String message = isEnquiry
                ? "Too many enquiries from here. Please wait a little before trying again."
                : "Too many booking requests from here. Please wait a little before trying again.";
        String ip = request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
        long now = System.currentTimeMillis();
        Window window = counters.compute(ip, (key, old) -> {
            if (old == null || now - old.start >= WINDOW_MS) return new Window(now);
            return old;
        });
        boolean over;
        synchronized (window) {
            window.count++;
            over = window.count > maxHits;
        }
        if (counters.size() > 2000) {
            counters.entrySet().removeIf(entry -> now - entry.getValue().start >= WINDOW_MS);
        }
        if (over) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"" + message + "\",\"success\":false}");
            return;
        }

        try {
            chain.doFilter(new LimitedBodyRequest(request), response);
        } catch (BodyTooLargeException e) {
            writeTooLarge(response);
        }
    }

    private static void writeTooLarge(HttpServletResponse response) throws IOException {
        response.setStatus(413);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"Request is too large. Please reduce the file or message size.\",\"success\":false}");
    }

    /** Buffers at most 5 MB so chunked requests cannot bypass the content-length check. */
    private static final class LimitedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        LimitedBodyRequest(HttpServletRequest request) throws IOException {
            super(request);
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int total = 0;
            int read;
            while ((read = request.getInputStream().read(buffer)) != -1) {
                total += read;
                if (total > MAX_BODY_BYTES) throw new BodyTooLargeException();
                bytes.write(buffer, 0, read);
            }
            this.body = bytes.toByteArray();
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public int read() { return input.read(); }
                @Override public boolean isFinished() { return input.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) {
                    throw new IllegalStateException("Asynchronous form reads are not supported.");
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            String encoding = getCharacterEncoding();
            Charset charset = encoding == null ? StandardCharsets.UTF_8 : Charset.forName(encoding);
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }

        @Override public int getContentLength() { return body.length; }
        @Override public long getContentLengthLong() { return body.length; }
    }

    private static final class BodyTooLargeException extends IOException {
        private static final long serialVersionUID = 1L;
    }
}
