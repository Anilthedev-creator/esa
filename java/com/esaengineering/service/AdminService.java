package com.esaengineering.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.esaengineering.dto.CustomerDTO;
import com.esaengineering.model.Booking;
import com.esaengineering.model.Contact;
import com.esaengineering.model.Payment;
import com.esaengineering.model.PaymentStatus;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.PaymentRepository;
import com.esaengineering.repository.UserRepository;

import org.springframework.stereotype.Service;

@Service
public class AdminService {

    private final BookingRepository bookingRepository;
    private final ContactRepository contactRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;

    public AdminService(
            BookingRepository bookingRepository,
            ContactRepository contactRepository,
            UserRepository userRepository,
            PaymentRepository paymentRepository) {

        this.bookingRepository = bookingRepository;
        this.contactRepository = contactRepository;
        this.userRepository = userRepository;
        this.paymentRepository = paymentRepository;
    }

    /*
     * Existing customer management method.
     * Gets booking information and converts it into CustomerDTO.
     */
    public List<CustomerDTO> getAllBookings() {

        List<CustomerDTO> customers = new ArrayList<>();

        List<Booking> bookings = bookingRepository.findAll();

        for (Booking booking : bookings) {
            customers.add(new CustomerDTO(booking));
        }

        return customers;
    }

    /*
     * Dashboard statistics.
     */
    public Map<String, Object> getDashboardStats() {

        List<Booking> bookings = bookingRepository.findAll();
        List<Contact> enquiries = contactRepository.findAll();

        // Total registered users
        long totalUsers = userRepository.count();

        // Active/upcoming bookings (not cancelled and not in the past)
        long activeBookings = bookings.stream()
                .filter(booking ->
                        booking.getBookingDate() != null
                        && !booking.getBookingDate().isBefore(LocalDate.now())
                        && !"cancelled".equalsIgnoreCase(booking.getStatus()))
                .count();

        // Enquiries that have not been resolved yet
        long pendingEnquiries = enquiries.stream()
                .filter(enquiry -> !"resolved".equalsIgnoreCase(enquiry.getStatus()))
                .count();

        // Real revenue = sum of all successful payments
        double revenue = 0.0;
        List<Payment> payments = paymentRepository.findAll();
        for (Payment payment : payments) {
            if (payment.getStatus() == PaymentStatus.SUCCESS && payment.getAmount() != null) {
                revenue += payment.getAmount().doubleValue();
            }
        }

        // Recent service requests
        List<Map<String, Object>> recentRequests = new ArrayList<>();

        int bookingLimit = Math.min(5, bookings.size());

        for (int i = bookings.size() - 1;
             i >= bookings.size() - bookingLimit;
             i--) {

            Booking booking = bookings.get(i);

            Map<String, Object> request = new HashMap<>();

            request.put("customer", booking.getFullName());
            request.put("service", booking.getServiceName());
            request.put("date", booking.getBookingDate());
            request.put("status", booking.getStatus() == null ? "pending" : booking.getStatus());

            recentRequests.add(request);
        }

        // Recent enquiries
        List<Map<String, Object>> recentEnquiries = new ArrayList<>();

        int enquiryLimit = Math.min(5, enquiries.size());

        for (int i = enquiries.size() - 1;
             i >= enquiries.size() - enquiryLimit;
             i--) {

            Contact enquiry = enquiries.get(i);

            Map<String, Object> item = new HashMap<>();

            item.put("id", enquiry.getContactId());
            item.put("name", enquiry.getFullName());
            item.put("preview", enquiry.getDescription());

            recentEnquiries.add(item);
        }

        // Prepare response
        Map<String, Object> stats = new HashMap<>();

        stats.put("totalUsers", totalUsers);
        stats.put("activeBookings", activeBookings);
        stats.put("pendingEnquiries", pendingEnquiries);
        stats.put("revenue", revenue);

        Map<String, Object> response = new HashMap<>();

        response.put("stats", stats);
        response.put("recentRequests", recentRequests);
        response.put("recentEnquiries", recentEnquiries);

        return response;
    }
}
