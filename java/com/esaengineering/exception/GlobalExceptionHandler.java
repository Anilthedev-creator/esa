package com.esaengineering.exception;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

// Catches errors from the controllers and sends back simple
// json instead of the default white label error page.
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 404 when something is not found
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException error) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", error.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    // 400 when the input data is wrong
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException error) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", error.getMessage());
        return ResponseEntity.badRequest().body(body);
    }

    // 400 when a @Valid check fails, the frontend reads data.errors[0].message
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationErrors(MethodArgumentNotValidException error) {
        List<Map<String, String>> errors = new ArrayList<>();

        error.getBindingResult().getFieldErrors().forEach(fieldError -> {
            Map<String, String> oneError = new HashMap<>();
            oneError.put("field", fieldError.getField());
            oneError.put("message", fieldError.getDefaultMessage());
            errors.add(oneError);
        });

        Map<String, Object> body = new HashMap<>();
        body.put("message", "Please check your input and try again");
        body.put("errors", errors);

        return ResponseEntity.badRequest().body(body);
    }

    // 500 for anything else, the real error is printed in the server log
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleOtherErrors(Exception error) {
        error.printStackTrace();
        Map<String, Object> body = new HashMap<>();
        body.put("message", "Something went wrong on the server");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
