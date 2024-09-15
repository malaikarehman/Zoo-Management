const bcrypt = require('bcryptjs');
const { db, dbQuery } = require('../db');const fs = require('fs');
const path = require('path');



function handleSignup(parsedBody, res,sessions) {
    const username = parsedBody.get('username');
    const email = parsedBody.get('email');
    const password = parsedBody.get('password');
    let errors = {};

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            errors.general = 'Internal Server Error';
            renderForm(res, errors);
            return;
        }
        if (results.length > 0) {
            errors.email = 'This email is already registered';
        }
        if (!password || password.length < 8) {
            errors.password = 'Password must be at least 8 characters long';
        }
        if (Object.keys(errors).length > 0) {
            renderForm(res, errors, { username, email, password });
        } else {
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    errors.general = 'Failed to process password';
                    renderForm(res, errors);
                    return;
                }
                db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash], (err, result) => {
                    if (err) {
                        errors.general = 'Failed to register';
                        renderForm(res, errors);
                        return;
                    }
                    res.writeHead(302, { 'Location': '/home' });
                    res.end();
                });
            });
        }
    });
}

function renderForm(res, errors, previousValues = {}) {
    const filePath = path.join(__dirname, '..', 'public', 'signup.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Internal Server Error</h1>');
            return;
        }
        // Replace placeholders in HTML
        data = data.replace(/{{usernameError}}/g, errors.username || '');
        data = data.replace(/{{emailError}}/g, errors.email || '');
        data = data.replace(/{{passwordError}}/g, errors.password || '');
        data = data.replace(/{{username}}/g, previousValues.username || '');
        data = data.replace(/{{email}}/g, previousValues.email || '');
        data = data.replace(/{{password}}/g, previousValues.password || '');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
}


function handleLogin(parsedBody, res, sessions) {
    const email = parsedBody.get('email');
    const password = parsedBody.get('password');
    let errors = {};

    db.query('SELECT id, email, password, role FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            errors.general = 'Internal Server Error';
            renderLoginForm(res, errors);
            return;
        }
        if (results.length === 0) {
            errors.email = 'No user found with that email address';
            renderLoginForm(res, errors);
            return;
        }

        bcrypt.compare(password, results[0].password, (err, match) => {
            if (err) {
                errors.general = 'Internal Server Error';
                renderLoginForm(res, errors);
                return;
            }

            if (!match) {
                errors.password = 'Incorrect password';
                renderLoginForm(res, errors);
                return;
            }

            // Correct password, set up session
            const user = results[0];
            const sessionId = generateSecureSessionId(); // Use a secure method to generate a session ID

            // Store more detailed user info in the session
            sessions[sessionId] = {
                userId: user.id,
                email: user.email,
                role: user.role // Assuming you have roles defined in your database
            };

            // Set a secure cookie with the session ID
            res.writeHead(302, {
                'Location': '/dashboard', // Redirect to the dashboard or home page
                'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/; Secure; SameSite=Strict`
            });
            res.end();
        });
    });
}

function generateSecureSessionId() {
    // Generates a secure random session ID using Node.js's crypto module
    return require('crypto').randomBytes(16).toString('hex');
}
function renderLoginForm(res, errors, previousValues = {}) {
    previousValues = {};
    const filePath = path.join(__dirname, '..', 'public', 'login.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Internal Server Error</h1>');
            return;
        }
        errors.general = errors.general || '';
        errors.email = errors.email || '';
        errors.password = errors.password || '';
        // Replace placeholders in HTML
        data = data.replace(/{{generalError}}/g, errors.general || '');
        data = data.replace(/{{emailError}}/g, errors.email || '');
        data = data.replace(/{{passwordError}}/g, errors.password || '');
        data = data.replace(/{{email}}/g, previousValues.email || '');
        data = data.replace(/{{password}}/g, ''); // don't repopulate password fields.
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
}


async function updateUserPassword(req, res, parsedBody, userId) {
    const currentPassword = parsedBody.get('currentPassword');
    const newPassword = parsedBody.get('newPassword');
    const confirmPassword = parsedBody.get('confirmPassword');

    if (newPassword !== confirmPassword) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Passwords do not match');
        return;
    }

    try {
        const results = await dbQuery('SELECT password FROM users WHERE id = ?', [userId]);
        if (results.length === 0) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('User not found');
            return;
        }

        const user = results[0];
        if (typeof user.password !== 'string' || typeof currentPassword !== 'string') {
            console.error('Password data type error:', user.password, currentPassword);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error: Incorrect data types for password');
            return;
        }

        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
            res.end('Current password is incorrect');
            return;
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await dbQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        res.writeHead(302, { 'Location': '/dashboard' }); // Redirect to the dashboard
        res.end('Password changed successfully');
    } catch (err) {
        console.error('Error updating password:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
    }
}



module.exports = {  renderForm,renderLoginForm, handleSignup,handleLogin,updateUserPassword};
