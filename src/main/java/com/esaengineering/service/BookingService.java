package com.esaengineering.service;

import java.util.Optional;
import java.util.List;
import java.util.ArrayList;

import org.springframework.stereotype.Service;

import com.esaengineering.model.Booking;
import com.esaengineering.model.User;

import com.esaengineering.repository.BookingRepository;

@Service
public class BookingService{

    private final BookingRepository bookingRepository;


    public BookingService ( BookingRepository bookingRepository ){
        this.bookingRepository = bookingRepository;

    }
/*
save booking

*/

    public Booking saveBooking( Booking booking){
        return bookingRepository.save(booking);
    }
    

    public List<Booking> getAllBookings(){
        return bookingRepository.findAll();
        
    }

//new added
    public List <Booking> getBookingsByEmail (String email){

        return bookingRepository.findByEmail(email);

    }
///new added
    public boolean checkBookingByEmail( String email){
        return bookingRepository.existsByEmail( email);

    }
//new added
    public Long countBookingByService( String serviceName){
        return bookingRepository.countByServiceName(serviceName);
    }






public Optional <Booking> getBookingsById( Long Id){
    return bookingRepository.findByBookingId(Id); 
}




    public boolean deleteBooking( Long bookingId){
        if (! bookingRepository.existsById(bookingId)
        
        ){
            return false;
        }

        bookingRepository.deleteById(bookingId);
        return true;


    }


}