package com.esaengineering.api;

import com.esaengineering.model.Contact;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Sends an enquiry acknowledgement and team notice when SMTP is configured. */
@Service
public class EnquiryEmailService {

    private static final Logger log = LoggerFactory.getLogger(EnquiryEmailService.class);

    private final JavaMailSender mailSender;
    private final String smtpHost;
    private final String fromAddress;
    private final String teamAddress;

    public EnquiryEmailService(ObjectProvider<JavaMailSender> mailSenderProvider,
                               @Value("${spring.mail.host:}") String smtpHost,
                               @Value("${app.mail.from:}") String fromAddress,
                               @Value("${app.mail.enquiry-to:}") String teamAddress) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.smtpHost = smtpHost == null ? "" : smtpHost.trim();
        this.fromAddress = fromAddress == null ? "" : fromAddress.trim();
        this.teamAddress = teamAddress == null ? "" : teamAddress.trim();
    }

    public Map<String, Object> notifyEnquiry(Contact contact) {
        String customerBody = "Hi " + contact.getFullName() + ",\n\n"
                + "Thanks for contacting ESA Engineering. Your enquiry reference is #" + contact.getContactId() + ".\n"
                + "This is an automatic acknowledgement, not an appointment confirmation or engineering advice.\n"
                + "Our team will review your message. For urgent matters, please call 0402 464 823.\n\n"
                + "- ESA Engineering";
        String teamBody = "New website enquiry #" + contact.getContactId() + "\n"
                + "Name: " + contact.getFullName() + "\n"
                + "Email: " + contact.getEmail() + "\n"
                + "Service: " + contact.getServiceName() + "\n\n"
                + "Message:\n" + (contact.getDescription() == null ? "-" : contact.getDescription());

        String customerStatus = deliver(contact.getEmail(), "Enquiry received - ESA Engineering", customerBody);
        String teamStatus = deliver(teamAddress, "New ESA website enquiry #" + contact.getContactId(), teamBody);
        Map<String, Object> result = new LinkedHashMap<>();
        boolean smtpConfigured = mailSender != null && !smtpHost.isEmpty() && !fromAddress.isEmpty();
        result.put("customerAcknowledgement", customerStatus);
        result.put("teamNotification", teamStatus);
        result.put("smtpConfigured", smtpConfigured);
        result.put("message", deliveryMessage(customerStatus, teamStatus, smtpConfigured));
        return result;
    }

    private String deliver(String recipient, String subject, String body) {
        String to = recipient == null ? "" : recipient.trim();
        if (to.isEmpty()) return "not-configured";
        if (mailSender != null && !smtpHost.isEmpty() && !fromAddress.isEmpty()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromAddress);
                message.setTo(to);
                message.setSubject(subject.replaceAll("[\\r\\n]+", " "));
                message.setText(body);
                mailSender.send(message);
                return "sent";
            } catch (MailException | IllegalArgumentException e) {
                log.warn("SMTP delivery failed for an enquiry email; saving it to the local outbox.");
            }
        }
        try {
            saveOutbox(to, subject, body);
            return "outbox";
        } catch (IOException | SecurityException e) {
            log.error("Could not send an enquiry email or save it to the local outbox.");
            return "failed";
        }
    }

    private static void saveOutbox(String to, String subject, String body) throws IOException {
        Path directory = Paths.get("data", "outbox");
        Files.createDirectories(directory);
        try {
            Files.setPosixFilePermissions(directory, PosixFilePermissions.fromString("rwx------"));
        } catch (UnsupportedOperationException ignored) {
            // Windows does not support POSIX file permissions.
        }
        String safeSubject = subject.replaceAll("[\\r\\n]+", " ");
        String fileName = System.currentTimeMillis() + "-" + UUID.randomUUID() + ".txt";
        String contents = "To: " + to + "\nSubject: " + safeSubject + "\nDate: " + Instant.now() + "\n\n" + body + "\n";
        Path outboxFile = directory.resolve(fileName);
        try {
            Files.createFile(outboxFile, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
        } catch (UnsupportedOperationException ignored) {
            Files.createFile(outboxFile);
        }
        Files.writeString(outboxFile, contents, StandardOpenOption.WRITE);
    }

    private static String deliveryMessage(String customerStatus, String teamStatus, boolean smtpConfigured) {
        if ("sent".equals(customerStatus) && "sent".equals(teamStatus)) {
            return "Thanks — your enquiry is recorded. A confirmation email has been sent and the ESA team has been notified.";
        }
        if ("sent".equals(customerStatus)) {
            return "Thanks — your enquiry is recorded and a confirmation email was sent. ESA team email delivery is not available right now; call us for urgent requests.";
        }
        if ("sent".equals(teamStatus)) {
            return "Thanks — your enquiry is recorded and the ESA team has been notified. A confirmation email could not be sent; call us if you need to follow up.";
        }
        if (!smtpConfigured) {
            return "Thanks — your enquiry is recorded. Automatic email delivery is not configured, so no email was sent. Call ESA for urgent requests.";
        }
        if ("outbox".equals(teamStatus)) {
            return "Thanks — your enquiry is recorded. Email delivery failed, but a copy was saved for the ESA team. Call us for urgent requests.";
        }
        if ("outbox".equals(customerStatus)) {
            return "Thanks — your enquiry is recorded. A confirmation email could not be delivered, but a copy was saved locally. Call ESA for urgent requests.";
        }
        return "Thanks — your enquiry is recorded, but no email could be sent. Call ESA for urgent requests.";
    }
}
