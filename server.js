const http = require('http');
const mysql = require('mysql');
const url = require('url');
const fs = require('fs');
const querystring = require('querystring');
// Load error messages from errorMessages.json
const errorMessages = JSON.parse(fs.readFileSync('errorMessages.json', 'utf-8'));
const path = require('path');
const userController = require("./controllers/userController");
const bookingController = require("./controllers/bookingController");
const dashboardController = require("./controllers/dashboardController");

// Simple session storage
let sessions = {};

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://${req.headers.host}');
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const parsedBody = new URLSearchParams(body);
            handlePostRequest(parsedUrl, parsedBody,req, res);
        });
    } else if (req.method === 'GET') {
        handleGetRequest(parsedUrl, res,req);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
    }
});

function handlePostRequest(parsedUrl, parsedBody, req, res) {
    const cookies = parseCookies(req);
    const sessionId = cookies['sessionId'];  // Assuming the cookie name for the session ID is 'sessionId'


    let pathname = parsedUrl.pathname;
    pathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const segments = pathname.split('/');
    
    switch(segments[1]) {
        case 'signup':
        //   userController.registerUser(parsedBody.get('username'), parsedBody.get('email'), parsedBody.get('password'), res, sessions);
        userController.handleSignup(parsedBody, res, sessions);
        // return;
            break;

        case 'login':
        //   userController.loginUser(parsedBody.get('email'), parsedBody.get('password'), res, sessions);
        userController.handleLogin(parsedBody,res,sessions);
            break;
        case 'change-password' :
            const user = sessions[sessionId];
                userController.updateUserPassword(req, res, parsedBody,user.userId);
                return;
            
        case 'cancel-booking':
            const bookingId = segments[2]; // Assuming URL is like /booking-details/123
            if (bookingId) {
                bookingController.cancelBooking(bookingId, res);
                return;
            } else {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>Booking not found</h1>');
                return;
            }
            break;
        case 'booking-reschedule':
                if (segments.length > 2) {
                    const bookingId = segments[2];
                    bookingController.updateBookingDetails(bookingId, parsedBody, res);
                }
                break;
        case 'book':
            if (sessionId && sessions[sessionId]) {
                bookingController.processBooking(sessionId, parsedBody, res, sessions);
            } else {
                res.writeHead(401, { 'Content-Type': 'text/plain' });
                res.end('You must be logged in to make a booking');
            }
          break;
        default:
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
    }
}

function handleGetRequest(parsedUrl, res, req) {
    let pathname = parsedUrl.pathname;
    let staticpath = pathname;  // Good practice to clone pathname if you need the original value later.
    pathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const segments = pathname.split('/');  // Initialize here and use throughout the function.

    // Parse cookies to check for a valid session
    const cookies = parseCookies(req);
    const sessionId = cookies['sessionId'];

    // Paths that require authentication
    const protectedPaths = ['book', 'dashboard', 'booking-details', 'booking-reschedule', 'change-password'];

    if (protectedPaths.includes(segments[1]) && (!sessionId || !sessions[sessionId])) {
        res.writeHead(302, { 'Location': '/login' });
        res.end();
        return;
    }

    switch (segments[1]) {
        case 'signup':
            userController.renderForm(res, {});
            break;
        case 'login':
            userController.renderLoginForm(res, {});
            break;
            
    case 'change-password':
serveStaticFiles('/change-password', res);        break;
        case 'book':
            filePath = path.join(__dirname, 'public', 'book.html');
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>File not found</h1>');
                    console.error("Failed to read file:", err);
                    return;
                }
                res.writeHead(200, { 'Content-Type': getContentType(path.extname(filePath)) });
                res.end(data);
            });
            break;
        case 'booking-reschedule':
            if (segments.length > 2) {
                const bookingId = segments[2];
                bookingController.renderRescheduleForm(bookingId, res);
            } else {
                serveStaticFiles(parsedUrl.pathname, res);
            }
            break;
        case 'dashboard':
            const user = sessions[sessionId];
            dashboardController.renderDashboard(res, user.userId, user.role);
            break;
        case 'booking-details':
            const bookingId = segments[2];  // Use variable without redeclaring it.
            if (bookingId) {
                bookingController.renderBookingDetails(bookingId, res, sessions[sessionId]);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>Booking not found</h1>');
            }
            break;
        default:
            serveStaticFiles(staticpath, res);
            break;
    }
}


function serveStaticFiles(pathname, res) {
    let filePath;

    switch (pathname) {
        case '/':
        case '/home':
            filePath = path.join(__dirname, 'public', 'home.html');
            break;
        case '/signup':
            filePath = path.join(__dirname, 'public', 'signup.html');
            break;
        case '/login':
            filePath = path.join(__dirname, 'public', 'login.html');
            break;
        case '/terms-condition':
            filePath = path.join(__dirname, 'public', 'terms-condition.html');
            break;
        case '/change-password':
            filePath = path.join(__dirname, 'public', 'change-password.html');
            break;
        // case '/book':
        //     filePath = path.join(__dirname, 'public', 'book.html');
        //     break;
        case '/about':
            filePath = path.join(__dirname, 'public', 'about.html');
            break;
        case '/accessibility':
            filePath = path.join(__dirname, 'public', 'accessibility.html');
            break;
        case '/articles':  // Corrected spelling from 'atricles' to 'articles'
            filePath = path.join(__dirname, 'public', 'articles.html');
            break;
        // case '/booking-reschedule':
        //     filePath = path.join(__dirname, 'public', 'booking-reschedule.html');
        //     break;
      
        case '/educational-material':
            filePath = path.join(__dirname, 'public', 'educational-material.html');
            break;
        case '/loyalty-board':  // Corrected spelling from 'loyality-board' to 'loyalty-board'
            filePath = path.join(__dirname, 'public', 'loyalty-board.html');
            break;
        case '/loyalty':  // Corrected spelling from 'loyality' to 'loyalty'
            filePath = path.join(__dirname, 'public', 'loyalty.html');
            break;
        case '/quiz':
            filePath = path.join(__dirname, 'public', 'quiz.html');
            break;
        case '/resorts-show':
            filePath = path.join(__dirname, 'public', 'resorts-show.html');
            break;
        case '/zoo-guide':
            filePath = path.join(__dirname, 'public', 'zoo-guide.html');
            break;
        default:
            // If no known static page matches, send a 404 response.
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>File not found</h1>');
            return;
    }

    // Serve the file
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>File not found</h1>');
            console.error("Failed to read file:", err);
            return;
        }
        res.writeHead(200, { 'Content-Type': getContentType(path.extname(filePath)) });
        res.end(data);
    });
}


function parseCookies(req) {
    const cookieHeader = req.headers.cookie || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const parts = cookie.split('=').map(part => part.trim()); // Trimming each part to handle whitespaces
        if (parts.length === 2) {
            acc[parts[0]] = parts[1];
        }
        return acc;
    }, {});
    return cookies;
}



function getContentType(ext) {
    switch (ext) {
        case '.html': return 'text/html';
        case '.css': return 'text/css';
        case '.js': return 'text/javascript';
        case '.png': return 'image/png';
        case '.jpg': return 'image/jpeg';
        default: return 'text/plain';
    }
}

server.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
