const bookingController = require('./bookingController');
// const db = require('../db');
const { db, dbQuery } = require('../db');const fs = require('fs');

function renderDashboard(res, userId, role) {
    // Check if the user is an admin
    const isAdmin = (role === "admin");

    bookingController.fetchBookings(userId, isAdmin, async (err, bookings) => {
        if (err) {
            res.writeHead(500, {'Content-Type': 'text/html'});
            res.end('<h1>Internal Server Error</h1>');
            return;
        }

        // Fetch loyalty points from the database
        let points = 0;
        let pointsPercentage = 0;
        const maxPoints = 5000; // Define a max points to calculate percentage for the progress bar
        
        try {
            const pointsResult = await dbQuery('SELECT points FROM loyalty_points WHERE user_id = ?', [userId]);
            if (pointsResult.length > 0) {
                points = pointsResult[0].points;
                pointsPercentage = (points / maxPoints) * 100;
            }
        } catch (pointsError) {
            console.error('Failed to fetch loyalty points:', pointsError);
            // Optionally handle error or default the points to 0
            res.writeHead(500, {'Content-Type': 'text/html'});
            res.end(`<h1>Error Fetching Points: ${pointsError.message} for user : ${userId}</h1>`);
            return;
        }
       

        let tableRows = bookings.map(booking => {
            const date = new Date(booking.booking_date);
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            formattedDate = date.toLocaleDateString('en-US', options) + ' PST';
            return `<tr>
                        <td>#${booking.booking_id}</td>
                        <td>${formattedDate}</td>
                        <td>${booking.ticket_type}</td>
                        <td><span class="badge bg-success">${booking.status}</span></td>
                        <td>
                        <div class="btn-group action-buttons">
                            <a href="/booking-details/${booking.booking_id}" class="btn btn-info">View</a>
                            <a href="/booking-reschedule/${booking.booking_id}" class="btn btn-warning">Reschedule</a>
                            <form method="POST" action="/cancel-booking/${booking.booking_id}">
                            <button  type="submit" class="btn btn-danger">Cancel</button>
                            </form></div>
                        </td>
                    </tr>`;
        }).join('');

        let responseHTML = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>User Dashboard - Riget Zoo Adventures</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f4f4f4;
                }
                header {
                    background-color: #007bff;
                    color: white;
                    padding: 10px 20px;
                    text-align: center;
                }
                .container {
                    width: 90%;
                    max-width: 1200px;
                    margin: 20px auto;
                    background: white;
                    padding: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
                h1, h2, h4 {
                    color: #333;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th, td {
                    border: 1px solid #ccc;
                    padding: 8px;
                    text-align: left;
                }
                .btn {
                    padding: 8px 12px;
                    color: white;
                    background-color: #007bff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                }
                .btn:hover {
                    background-color: #0056b3;
                }
                .btn-success {
                    background-color: #28a745;
                }
                .btn-info {
                    background-color: #17a2b8;
                }
                .btn-danger {
                    background-color: #dc3545;
                }
                .btn-group {
                    margin-top: 10px;
                        
                }
                
                .progress {
                    background-color: #e9ecef;
                    border-radius: 5px;
                    height: 20px;
                    width: 100%;
                }
                .progress-bar {
                    background-color: #007bff;
                    height: 100%;
                    width: 75%;
                }
                .alert {
                    color: #155724;
                    background-color: #d4edda;
                    border-color: #c3e6cb;
                    padding: 10px;
                    border-radius: 5px;
                    margin: 10px 0;
                }
                .form-group {
                    margin-bottom: 15px;
                }
                .form-control {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                a.btn {
                    text-decoration: none;
                    color: white;
                }
                header {
                    background-color: #f8f9fa;
                    padding: 10px 20px;
                    text-align: left;
                }
                header a {
                    text-decoration: none;
                    color: #007bff;
                }
                header h1 {
                    margin: 0;
                }
            </style>
        </head>
        <body>
            <header>
                <a href="/home">
                    <h1>Riget Zoo Adventures</h1>
                </a>
            </header>
            <div class="container">
                <h2>User Dashboard</h2>
                
                <div class="card">
                    <h2>Manage Your Bookings</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Booking ID</th>
                                <th>Date</th>
                                <th>Package</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                        ${tableRows}
                        </tbody>
                    </table>
                </div>
                <div class="card">
                    <h2>Loyalty and Rewards</h2>
                    <h4>Your Points: <span id="pointsCounter">${points}</span> Points</h4>
                    <div class="progress">
                        <div class="progress-bar" style="width: ${pointsPercentage}%"></div>
                    </div>
                    <div class="alert">
                        <strong>New Achievement!</strong> You've earned a bonus for consistent visits!
                    </div>
                    <div class="btn-group">
                        <a href="/loyality-board" class="btn btn-info">View Rewards</a>
                        <a class="btn btn-success" href="/redeem">Redeem Points</a>
                        <a class="btn btn-success" href="/change-password">Change Password</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(responseHTML);
    });
}




module.exports = { renderDashboard };
