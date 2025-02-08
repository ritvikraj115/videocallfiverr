const express = require('express');
const db = require('../db');
const verifyToken = require('../middleware/authmiddleware');
const router = express.Router();


// Get meeting details and verify authToken
// Get meeting details and verify authToken
router.get('/meetings/:meetingId', verifyToken, (req, res) => {
    const meetingId = req.params.meetingId;

    // Fetch meeting details from DB
    const sql = 'SELECT meeting_id, start_time, participants FROM meetings WHERE meeting_id = ?';
    db.query(sql, [meetingId], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        if (results.length === 0) {
            return res.status(404).json({ error: "Meeting not found" });
        }

        const meeting = results[0];
        const participants = JSON.parse(meeting.participants); // Assuming participants are stored as JSON
        const userId = req.user.id; // Extracted from JWT token
        const meetingStartTime = new Date(meeting.start_time); // Convert to Date object
        const currentTime = new Date(); // Get current time

        // Check if the authenticated user is in the participant list
        if (!participants.includes(userId)) {
            return res.status(403).json({ error: "Unauthorized. You are not a participant in this meeting." });
        }

        // Compare current time with the meeting start time
        if (currentTime < meetingStartTime) {
            return res.status(400).json({ error: "The meeting has not started yet." });
        }

        // If the current time is equal to the start time, allow the meeting to start
        res.status(200).json({ message: "Meeting started", details: meeting });
    });
});


/**
 * POST /api/meeting/end
 * Updates meeting details when it ends.
 */
router.post('/meeting/end', (req, res) => {
    const { meetingId, participants, startTime, endTime } = req.body;

    if (!meetingId || !participants || !startTime || !endTime) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if the meeting exists in the meetings table
    db.query('SELECT * FROM meetings WHERE meeting_id = ?', [meetingId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length === 0) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Calculate the duration in seconds
        const duration = Math.abs(new Date(endTime) - new Date(startTime)) / 1000;

        // Convert participants array to JSON
        const participantsJson = JSON.stringify(participants);

        // Insert the meeting data into user_meetings table
        db.query(
            'INSERT INTO user_meetings (meeting_id, participants, start_time, end_time, duration) VALUES (?, ?, ?, ?, ?)',
            [meetingId, participantsJson, startTime, endTime, duration],
            (err, result) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({ message: 'Meeting record inserted successfully' });
            }
        );
    });
});


/**
 * POST /api/feedback
 * Stores user feedback.
 */
router.post('/feedback', (req, res) => {
    const { homeownerUserId, serviceProviderUserId, rating, primaryReason } = req.body;

    if (!homeownerUserId || !serviceProviderUserId || !rating || !primaryReason) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const reasonsJson = JSON.stringify(primaryReason.split(','));

    db.query(
        'INSERT INTO user_service_feedback (homeowner_userid, serviceprovider_userid, rating, primary_reason) VALUES (?, ?, ?, ?)',
        [homeownerUserId, serviceProviderUserId, rating, reasonsJson],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({ message: 'Feedback submitted successfully' });
        }
    );
});

// Update or insert chat messages and attachments
router.post('/meeting/chat/update', (req, res) => {
    const { meetingId, userId, messages, attachments } = req.body;

    if (!meetingId || !userId || !messages) {
        return res.status(400).json({ error: 'Meeting ID, User ID, and Messages are required' });
    }

    // Check if a chat entry already exists for this meeting and user
    const checkQuery = 'SELECT messages, attachments FROM meeting_chats WHERE meeting_id = ? AND user_id = ?';

    db.query(checkQuery, [meetingId, userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err });

        if (results.length > 0) {
            // If an entry exists, update it by appending messages and attachments
            let existingMessages = JSON.parse(results[0].messages);
            let existingAttachments = results[0].attachments ? JSON.parse(results[0].attachments) : [];

            // Append new messages and attachments
            existingMessages.push(...messages);
            existingAttachments.push(...(attachments || []));

            const updateQuery = 'UPDATE meeting_chats SET messages = ?, attachments = ? WHERE meeting_id = ? AND user_id = ?';
            db.query(updateQuery, [JSON.stringify(existingMessages), JSON.stringify(existingAttachments), meetingId, userId], (err, result) => {
                if (err) return res.status(500).json({ error: 'Database error', details: err });

                res.status(200).json({ message: 'Chat updated successfully' });
            });
        } else {
            // If no existing entry, insert a new row
            const insertQuery = 'INSERT INTO meeting_chats (meeting_id, user_id, messages, attachments) VALUES (?, ?, ?, ?)';
            db.query(insertQuery, [meetingId, userId, JSON.stringify(messages), JSON.stringify(attachments || [])], (err, result) => {
                if (err) return res.status(500).json({ error: 'Database error', details: err });

                res.status(201).json({ message: 'Chat added successfully' });
            });
        }
    });
});


module.exports = router;
