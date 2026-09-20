package com.esaengineering.exception;

// Thrown when something is not found in the database,
// the handler below turns it into a 404 response.
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
