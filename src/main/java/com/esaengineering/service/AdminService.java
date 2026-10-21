package com.esaengineering.service;

import com.esaengineering.api.AdminDataService;
import com.esaengineering.dto.CustomerDTO;
import com.esaengineering.model.Booking;
import com.esaengineering.model.User;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminService {

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final AdminDataService adminDataService;

    public AdminService(BookingRepository bookingRepository,
                        UserRepository userRepository,
                        AdminDataService adminDataService) {
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.adminDataService = adminDataService;
    }

    /** Returns the booking rows used by the older admin customer page. */
    public List<CustomerDTO> getAllBookings() {
        List<CustomerDTO> customers = new ArrayList<>();
        Map<String, User> usersByEmail = new LinkedHashMap<>();
        for (User user : userRepository.findAll()) {
            if (user.getEmail() != null) {
                usersByEmail.putIfAbsent(user.getEmail().toLowerCase(Locale.ROOT), user);
            }
        }

        for (Booking booking : bookingRepository.findAll()) {
            CustomerDTO customer = new CustomerDTO(booking);
            User user = booking.getEmail() == null ? null
                    : usersByEmail.get(booking.getEmail().toLowerCase(Locale.ROOT));
            if (user != null) {
                customer.setPhoneNumber(user.getPhoneNumber());
                customer.setCompanyName(user.getCompanyName());
            }
            customers.add(customer);
        }
        return customers;
    }

    /** Keeps the legacy route in step with the dashboard API and its old keys. */
    public Map<String, Object> getDashboardStats() {
        Map<String, Object> response = adminDataService.stats();
        Object rawStats = response.get("stats");
        if (rawStats instanceof Map<?, ?> currentStats) {
            Map<String, Object> stats = new LinkedHashMap<>();
            currentStats.forEach((key, value) -> stats.put(String.valueOf(key), value));
            stats.put("totalUsers", stats.get("totalCustomers"));
            stats.put("activeBookings", stats.get("upcomingBookings"));
            stats.put("pendingEnquiries", stats.get("openEnquiries"));
            stats.put("revenue", stats.get("paidRevenue"));
            response.put("stats", stats);
        }
        return response;
    }
}
