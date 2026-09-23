package com.esaengineering.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.esaengineering.dto.CustomerDTO;
import com.esaengineering.model.Booking;
import com.esaengineering.model.Contact;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.UserRepository;

import org.springframework.stereotype.Service;

@Service
public class AdminService {

    private final BookingRepository bookingRepository;
    private final ContactRepository contactRepository;
    private final UserRepository userRepository;

    public AdminService(
            BookingRepository bookingRepository,
            ContactRepository contactRepository,
            UserRepository userRepository) {

        this.bookingRepository = bookingRepository;
        this.contactRepository = contactRepository;
        this.userRepository = userRepository;
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

        // Active/upcoming bookings
        long activeBookings = bookings.stream()
                .filter(booking ->
                        booking.getBookingDate() != null &&
                        !booking.getBookingDate().isBefore(LocalDate.now()))
                .count();

        // Currently there is no enquiry status field in Contact.
        // Therefore, we use the total number of enquiries.
        long pendingEnquiries = enquiries.size();

        /*
         * Payment/revenue functionality is not implemented in the
         * current backend, so we do not invent a revenue figure.
         */
        double revenue = 0.0;

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

            /*
             * Booking currently has no status field.
             * We therefore use "confirmed" as a temporary display
             * value for existing bookings.
             */
            request.put("status", "confirmed");

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
