app.post('/api/staff/activate', async (req, res) => {
  const { name, email, pin, role } = req.body;

  try {
    // Save to Postgres first
    const newStaff = await pool.query(
      'INSERT INTO staff (name, email, pin, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, pin, role]
    );

    // 2. Prepare the Professional Kurax Email
    const mailOptions = {
      from: '"Kurax Lounge & Bistro" <hello@kurax.ug>',
      to: email,
      subject: 'Welcome to the Team - Your Staff Access Portal',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #000; color: #fff; padding: 40px; border-radius: 10px;">
          <h1 style="color: #eab308; text-transform: uppercase;">Welcome to Kurax, ${name}!</h1>
          <p>Your staff account has been officially activated by the Director.</p>
          
          <div style="background-color: #111; border: 1px solid #eab308; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 5px;">Your Security PIN</p>
            <h2 style="font-size: 32px; letter-spacing: 10px; color: #eab308; margin: 0;">${pin}</h2>
          </div>

          <p style="font-size: 14px; line-height: 1.6;">
            Use this PIN and your email to access the <strong>Staff Portal</strong>. 
          </p>

          <div style="background-color: #7f1d1d; color: #fecaca; padding: 15px; border-radius: 5px; font-size: 12px; margin-top: 30px;">
            <strong>🚨 SECURITY PRECAUTION:</strong><br/>
            This PIN is for your eyes only. If you receive this email but did not request access, or if you suspect someone else has logged into your portal, please contact the Director immediately.
          </div>

          <p style="font-size: 10px; color: #444; margin-top: 40px; text-align: center;">
            © 2026 Kurax Food Lounge & Bistro | Luxury Dining & Rooftop Vibes
          </p>
        </div>
      `
    };

    // 3. Send the Email
    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: "Account activated and email sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database saved, but email failed to send." });
  }
});