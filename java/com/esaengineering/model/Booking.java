
package com.esaengineering.model;


import javax.annotation.processing.Generated;

import jakarta.persistence.*;
import java.time.LocalDate;






/*
This is a bookings table for database.
PostgreSql will receive table name called booking
*/


@Entity
@Table( name = "bookings")
public class Booking {


    @Id
    @GeneratedValue( strategy = GenerationType.IDENTITY)
    private long bookingId;

   

    @Column(nullable = false)
    private String fullName;


    @Column(nullable = false)
    private LocalDate bookingDate;

    @Column(nullable = false)
    private String abnNumber;


    @Column(nullable = false)
    private String serviceName;

    @Column(nullable = false)
    private String email;


    @Column(length = 1000)
    private String description;


    public Booking(){

    }
  



    public long getBookingID() {
        return bookingId;
    }


    public void setBookingID(long bookingId) {
        this.bookingId = bookingId;
    }


    public String getEmail(){
        return email;
    }

    public void setEmail( String email){
        this.email = email;
    }
    



    public String getFullName() {
        return fullName;
    }


    public void setFullName(String fullName) {
        this.fullName = fullName;
    }


    public LocalDate getBookingDate() {
        return bookingDate;
    }


    public void setBookingDate(LocalDate bookingDate) {
        this.bookingDate = bookingDate;
    }


    public String getAbnNumber() {
        return abnNumber;
    }


    public void setAbnNumber(String abnNumber) {
        this.abnNumber = abnNumber;
    }


    public String getServiceName() {
        return serviceName;
    }


    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }


    public String getDescription() {
        return description;
    }


    public void setDescription(String description) {
        this.description = description;
    }
    
}






