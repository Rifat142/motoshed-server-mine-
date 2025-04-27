const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
// for cookie
// const cookieParser = require("cookie-parser");
// for sending email and create pdf
// const express = require("express");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const router = express.Router();
require("dotenv").config();
const port = process.env.PORT || 5000;

// middle-ware
// app.use(cors());   //before the cors setting
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // 'https://motoshed-sever-mine.vercel.app',//this is vercel app
      "https://motoshed-8b5e6.web.app", // this is firebase deployment domain
    ],
    credentials: true,
  })
);
app.use(express.json());
// app.use(cookieParser());

// mongo db start

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qmpng5e.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server
    // await client.connect();

    const serviceCollection = client.db("motoshed2db").collection("services");
    const usersCollection = client.db("motoshed2db").collection("users");
    const comboCollection = client.db("motoshed2db").collection("combo");
    const productCollection = client.db("motoshed2db").collection("products");
    const cartCollection = client.db("motoshed2db").collection("cart");
    const ordersCollection = client.db("motoshed2db").collection("orders");
    const bookedCollection = client.db("motoshed2db").collection("booked");

    // jwt token api with cookie

    //end

    // before cookie

    // creating token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      if (!user || !user.email) {
        return res
          .status(400)
          .send({ message: "User data with email is required" });
      }
      // console.log('user details in token creation', user.email);

      const token = jwt.sign({ user }, process.env.JWT_TOKEN_SECRET, {
        expiresIn: "1hr",
      });
      // here token-name = name &  the value is token ;
      res.send({ token });
      // console.log(token,'token')
    });

    // middleware
    // token verification
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unathorized ver-access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      // console.log("verisfy token ", token)
      jwt.verify(token, process.env.JWT_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "  Unautorized access " });
        }

        req.decoded = decoded;

        next();
      });
      // if there is no token then it'll give you error automatically
    };

    // admin verify after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.user?.email;

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: " forbidden access" });
      }
      next();
    };
    -(
      // get the admin api , do not apply verify admin here
      app.get("/users/admin/:email", verifyToken, async (req, res) => {
        // in decoded we've given a email so the token will verify with the given token
        const email = req.params.email;

        if (email !== req.decoded.user.email) {
          return res.status(403).send({ message: "forbidden access " });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
      })
    );

    app.post("/users", async (req, res) => {
      const user = req.body;
      // add the user if it exists in login or register page
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exits ", InsertedId: null });
      }
      // if user dosen't exist it'll send to the database
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // users get method

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // users delete method
    // if you don't have an admin please remove these two middlewares
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // users admin method form dashboard
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // to get the all services api
    app.get("/services", async (req, res) => {
      const result = await serviceCollection.find().toArray();
      res.send(result);
    }),
      // to post a service
      app.post("/services", verifyToken, verifyAdmin, async (req, res) => {
        const data = req.body;
        const result = await serviceCollection.insertOne(data);
        // console.log("result for new service", result);
        res.send(result);
      });

    // to update a service
    app.patch("/services/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          title: data.title,
          benefits: data.benefits,
          description: data.description,
          price: data.price,
          info: data.info,
          image: data.image,
        },
      };
      const result = await serviceCollection.updateOne(filter, updatedData);
      res.send(result);
    });

    // to delete a service
    app.delete("/service/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.deleteOne(query);
      res.send(result);
    });

    //  to get a specific service via id
    app.get(`/services/:id`, async (req, res) => {
      const id = req.params.id;
      // console.log("id ", id);
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    // to get combo packages
    app.get("/combo", async (req, res) => {
      const result = await comboCollection.find().toArray();
      res.send(result);
    });
    //  to get a specific combo
    app.get("/combo/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await comboCollection.findOne(query);
      res.send(result);
    });

    app.patch("/combos/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          title: data.title,
          details: data.details,
          listDetails: data.listDetails,
          price: data.price,
        },
      };
      const result = await comboCollection.updateOne(filter, updatedData);
      res.send(result);
    });
    app.post("/combo", async (req, res) => {
      const data = req.body;
      const result = await comboCollection.insertOne(data);
      res.send(result);
    });
    app.delete("/combo/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await comboCollection.deleteOne(query);
      res.send(result);
    });

    //products api

    // products get
    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    // product delete
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    });

    //  create a product
    app.post("/products", async (req, res) => {
      const data = req.body;
      const result = await productCollection.insertOne(data);
      res.send(result);
    });
    //  get a single product
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    // product update
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          title: data.title,
          // this benefit is an array
          benefits: data.benefits,
          price: data.price,
          info: data.info,
          image: data.image,
        },
      };
      const result = await productCollection.updateOne(filter, updatedData);
      res.send(result);
    });
    // product serction end --------

    // cart section
    app.post("/cart", async (req, res) => {
      const data = req.body;
      const result = await cartCollection.insertOne(data);
      res.send(result);
    });
    //  get the specific user cart
    app.get("/cart/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    //   delete cart data
    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    // delete many
    app.delete("/cart", async (req, res) => {
      const ids = req.body.ids;
      if (!Array.isArray(ids)) {
        return res
          .status(400)
          .send({ message: "Invalid input, expected an array of IDs" });
      }
      const objectIds = ids.map((id) => new ObjectId(String(id)));
      const query = { _id: { $in: objectIds } };
      try {
        const result = await cartCollection.deleteMany(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete items", error });
      }
    });

    //cart serction ------------end

    // order post
    app.post("/orders", async (req, res) => {
      const data = req.body;
      const result = await ordersCollection.insertOne(data);
      res.send(result);
    });

    // get the user orders with pagination
    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 5; // Default to 5 items per page
      const skip = (page - 1) * limit;

      const query = { userEmail: email };
      const result = await ordersCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();

      const totalOrders = await ordersCollection.countDocuments(query);
      const totalPages = Math.ceil(totalOrders / limit);

      res.send({
        data: result,
        currentPage: page,
        totalPages,
        totalOrders,
      });
    });

    // bakend api for all orders pagination for admin
    app.get("/orders", verifyToken, verifyAdmin, async (req, res) => {
      try {
        // Extract query parameters for pagination
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 5; // Default to 5 items per page
        const skip = (page - 1) * limit; // Calculate how many documents to skip

        // Fetch paginated and sorted orders
        const orders = await ordersCollection
          .find()
          .sort({ createdAt: -1 }) // Sort by newest orders first
          .skip(skip) // Skip documents for pagination
          .limit(limit) // Limit the number of documents returned
          .toArray();

        // let waitingForApprovalOrders = [];
        // let totalApprovedAmount = 0;

        // Get the total count of documents in the collection
        const totalOrders = await ordersCollection.countDocuments();
        const waitingForApprovalOrders = await ordersCollection
          .find({
            progress: "waiting for approval",
          })
          .toArray();

        // Calculate the total amount of approved orders
        const approvedOrders = await ordersCollection
          .find({ progress: "approved" })
          .toArray();
        const totalApprovedAmount = approvedOrders.reduce((total, order) => {
          return total + (order.totalPrice || 0); // Ensure price is valid
        }, 0);

        // Send the paginated orders and total count as the response
        res.status(200).json({
          orders,
          totalOrders,
          waitingForApprovalOrders,
          totalApprovedAmount,
        });
      } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({
          message: "Failed to fetch orders",
          error,
        });
      }
    });

    // approve the order via admin
    // always use verifyToen then verifyAdmin
    app.patch("/approval/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // console.log(id,'id in the orders page ');
      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          progress: "approved",
        },
      };
      const result = await ordersCollection.updateOne(filter, updatedData);
      res.send(result);
    });
    app.patch(
      "/orders-cancel/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        // console.log(id,'id in the orders page ');
        const filter = { _id: new ObjectId(id) };
        const updatedData = {
          $set: {
            progress: "canceled",
          },
        };
        const result = await ordersCollection.updateOne(filter, updatedData);
        res.send(result);
      }
    );
    // delete the order (only if you needed cuz it'll clear the doc)
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/booked", async (req, res) => {
      const data = req.body;
      const result = await bookedCollection.insertOne(data);
      res.send(result);
    });
    // for different user

    //get the booked services for user via pagination
    app.get("/booked/:email", async (req, res) => {
      const email = req.params.email;
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 5; // Default to 5 items per page
      const skip = (page - 1) * limit;

      const query = { email: email };
      const result = await bookedCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();

      const totalOrders = await bookedCollection.countDocuments(query);
      const totalPages = Math.ceil(totalOrders / limit);

      res.send({
        data: result,
        currentPage: page,
        totalPages,
        totalOrders,
      });
    });

    // to get the data of user bookings  with pagination
    app.get("/booked", verifyToken, verifyAdmin, async (req, res) => {
      try {
        // Extract query parameters for pagination
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 5; // Default to 5 items per page
        const skip = (page - 1) * limit; // Calculate the number of items to skip

        // Fetch paginated and sorted bookings
        const bookings = await bookedCollection
          .find()
          .sort({ createdAt: -1 }) // Sort by newest bookings first
          .skip(skip) // Skip items for pagination
          .limit(limit) // Limit the number of returned items
          .toArray();

        // Get the total number of documents
        const totalBookings = await bookedCollection.countDocuments();
        // let waitingForApprovalOrders = [];
        // let totalApprovedAmount = 0;

        // Fetch "waiting for approval" orders
        const waitingForApprovalOrders = await bookedCollection
          .find({ state: "processing" })
          .toArray();

        // Calculate the total amount of approved orders
        const approvedOrders = await bookedCollection
          .find({ state: "approved" })
          .toArray();
        const totalApprovedAmount = approvedOrders.reduce((total, order) => {
          return total + (order.price || 0); // Ensure price is valid
        }, 0);

        // Send the paginated bookings, waiting for approval orders, and approved total amount
        res.status(200).json({
          bookings, // Paginated bookings
          totalBookings, // Total bookings count
          waitingForApprovalOrders, // Array of waiting for approval orders
          totalApprovedAmount, // Sum of approved orders' prices
        });
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({
          message: "Failed to fetch bookings",
          error,
        });
      }
    });

    app.delete("/booked/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookedCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/booked/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updatedData = {
        $set: {
          state: "approved",
        },
      };
      const result = await bookedCollection.updateOne(filter, updatedData);
      res.send(result);
    });
    app.patch(
      "/booking-cancel/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        const filter = { _id: new ObjectId(id) };
        const updatedData = {
          $set: {
            state: "canceled",
          },
        };
        const result = await bookedCollection.updateOne(filter, updatedData);
        res.send(result);
      }
    );

    // -------------- email sending

    // for sending email and creating pdf of order  details
    // booking confirming

    app.post("/send-email-bookings", async (req, res) => {
      const { email, name, number, bookingDetails } = req.body;

      if (!email || !name || !number || !bookingDetails) {
        return res.status(400).json({
          message:
            "All required fields (email, name, number, bookingDetails) must be provided",
        });
      }

      try {
        // Create PDF dynamically
        const PDFDocument = require("pdfkit");
        const pdfDoc = new PDFDocument({ margin: 50 });
        const buffers = [];

        pdfDoc.on("data", (chunk) => buffers.push(chunk));
        pdfDoc.on("end", async () => {
          const pdfData = Buffer.concat(buffers);

          // Nodemailer configuration
          const nodemailer = require("nodemailer");
          const transporter = nodemailer.createTransport({
            service: "Gmail", // Replace with your email service
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS, // Store email credentials in environment variables
            },
          });

          // Email configuration
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Booking Confirmation - Motoshed",
            text: "Here are your booking details!",
            attachments: [
              {
                filename: "BookingDetails.pdf",
                content: pdfData,
              },
            ],
          };

          // Send email
          await transporter.sendMail(mailOptions);
          return res.status(200).json({ message: "Email sent successfully!" });
        });

        // PDF Header
        pdfDoc.fontSize(26).text("Motoshed", { align: "center" });
        pdfDoc.moveDown();
        pdfDoc.fontSize(20).text("Booking Confirmation", { align: "center" });
        pdfDoc.moveDown();

        // User Details Section
        pdfDoc.fontSize(14).text(`Name: ${name}`);
        pdfDoc.text(`Email: ${email}`);
        pdfDoc.text(`Contact Number: ${number}`);
        pdfDoc.moveDown();

        // Booking Details Table Header
        pdfDoc.fontSize(16).text("Order Details", { underline: true });
        pdfDoc.moveDown();

        // Table Header
        const tableTop = pdfDoc.y;
        const col1X = 50;
        const col2X = 250;

        pdfDoc.fontSize(12).text("Field", col1X, tableTop);
        pdfDoc.text("Details", col2X, tableTop);

        // Draw a line under the table header
        pdfDoc
          .moveTo(col1X, tableTop + 15)
          .lineTo(500, tableTop + 15)
          .stroke();

        // Add booking details in table format
        let y = tableTop + 25;

        Object.entries(bookingDetails).forEach(([key, value]) => {
          pdfDoc
            .fontSize(12)
            .text(key.charAt(0).toUpperCase() + key.slice(1), col1X, y); // Field Name
          pdfDoc.text(value, col2X, y); // Field Value
          y += 20;
        });

        // Footer
        pdfDoc.moveDown(2);
        pdfDoc
          .fontSize(12)
          .text("Thank you for booking with Motoshed!", { align: "center" });

        // Finalize the PDF
        pdfDoc.end();
      } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Failed to send email", error });
      }
    });
    // admin cancle the users order if he needed
    app.post("/cancel-order", async (req, res) => {
      const { orderId, userEmail, serviceName } = req.body;

      if (!orderId || !userEmail || !serviceName) {
        return res
          .status(400)
          .json({ message: "Order ID, email, and service name are required" });
      }

      try {
        // Nodemailer Configuration
        const transporter = nodemailer.createTransport({
          service: "Gmail", // Replace with your email service
          auth: {
            user: process.env.EMAIL_USER, // Add your email in .env
            pass: process.env.EMAIL_PASS, // Add your email password in .env
          },
        });

        // Email Content
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: userEmail,
          subject: "Order Cancellation - Motoshed",
          text: `Dear Customer,\n\nYour order for the service "${serviceName}" has been successfully canceled.\n\nIf you have any questions or need further assistance, please contact us.\n\nThank you,\nMotoshed Team`,
        };

        // Send Email
        await transporter.sendMail(mailOptions);

        // Respond to the client
        res
          .status(200)
          .json({ message: "Order canceled and email sent successfully!" });
      } catch (error) {
        console.error("Error canceling order:", error);
        res.status(500).json({ message: "Failed to cancel order", error });
      }
    });

    // for products admin aproved and email send with pdf to user

    app.post("/send-email-products", async (req, res) => {
      const { email, name, number, bookingDetails } = req.body;

      if (!email || !name || !number || !bookingDetails) {
        return res
          .status(400)
          .json({ message: "Email, name, and booking details are required" });
      }

      try {
        // Create PDF dynamically
        const pdfDoc = new PDFDocument({ margin: 50 });
        const buffers = [];

        pdfDoc.on("data", (chunk) => buffers.push(chunk));
        pdfDoc.on("end", async () => {
          const pdfData = Buffer.concat(buffers);

          // Nodemailer configuration
          const transporter = nodemailer.createTransport({
            service: "Gmail", // Replace with your email service
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          // Email configuration
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Booking Confirmation - Motoshed`,
            text: `Hi ${name},\n\nThank you for booking with Motoshed! Please find your booking details attached in the PDF file.\n\nBest regards,\nMotoshed Team`,
            attachments: [
              {
                filename: "BookingDetails.pdf",
                content: pdfData,
              },
            ],
          };

          // Send email
          await transporter.sendMail(mailOptions);
          return res.status(200).json({ message: "Email sent successfully!" });
        });

        // PDF Header
        pdfDoc.fontSize(26).text("Motoshed", { align: "center" });
        pdfDoc.moveDown();
        pdfDoc.fontSize(20).text("Booking Confirmation", { align: "center" });
        pdfDoc.moveDown();

        // Add user name
        pdfDoc.fontSize(14).text(`Customer Name: ${name}`, { align: "left" });
        pdfDoc.moveDown();
        // number section
        pdfDoc
          .fontSize(14)
          .text(`Customer Number: ${number}`, { align: "left" });
        pdfDoc.moveDown();

        // Add booking details (excluding the product list)
        pdfDoc.fontSize(14).text("Booking Details", { underline: true });
        pdfDoc.moveDown();
        const bookingDetailsTop = pdfDoc.y;

        // Add general booking info like Order ID, Location, etc.
        const startX = 50;
        let y = bookingDetailsTop;

        Object.entries(bookingDetails).forEach(([key, value]) => {
          if (key !== "products") {
            pdfDoc.text(key.charAt(0).toUpperCase() + key.slice(1), startX, y); // Field Name
            pdfDoc.text(value, 200, y); // Field Value
            y += 20;
          }
        });

        // Add products table
        const productsTableTop = y + 20;
        pdfDoc
          .moveTo(50, productsTableTop)
          .lineTo(500, productsTableTop)
          .stroke();
        pdfDoc.fontSize(14).text("Product Name", 50, productsTableTop + 10);
        pdfDoc.text("Quantity", 200, productsTableTop + 10);
        pdfDoc.text("Price", 300, productsTableTop + 10);
        pdfDoc.text("Total TK", 400, productsTableTop + 10);

        pdfDoc
          .moveTo(50, productsTableTop + 25)
          .lineTo(500, productsTableTop + 25)
          .stroke();

        // Function to wrap text
        const wrapText = (doc, text, x, y, maxWidth, lineHeight = 14) => {
          const words = text.split(" ");
          let line = "";
          words.forEach((word) => {
            const testLine = line + word + " ";
            const testWidth = doc.widthOfString(testLine);
            if (testWidth > maxWidth) {
              doc.text(line.trim(), x, y);
              line = word + " ";
              y += lineHeight;
            } else {
              line = testLine;
            }
          });
          if (line) doc.text(line.trim(), x, y);
          return y + lineHeight;
        };

        // Add product rows
        let productRowY = productsTableTop + 30;
        bookingDetails.products.forEach((product) => {
          productRowY = wrapText(pdfDoc, product.title, 50, productRowY, 130); // Wrap text for Product Name
          pdfDoc.text(product.quantity.toString(), 200, productRowY - 14); // Quantity
          pdfDoc.text(`TK${product.price.toFixed(2)}`, 300, productRowY - 14); // Price
          pdfDoc.text(
            `TK${(product.quantity * product.price).toFixed(2)}`,
            400,
            productRowY - 14
          ); // Total

          productRowY += 20; // Move to next row
        });

        // Footer
        pdfDoc.moveDown(2);
        pdfDoc
          .fontSize(12)
          .text("Thank you for booking with Motoshed!", { align: "center" });

        // Finalize the PDF
        pdfDoc.end();
      } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Failed to send email", error });
      }
    });

    // to admin for order confirmation

    app.post("/send-order-details", async (req, res) => {
      const { userName, userEmail, serviceName, price } = req.body;

      // Validate request body
      if (!userName || !userEmail || !serviceName || !price) {
        return res.status(400).json({
          message: "User name, email, service name, and price are required",
        });
      }

      try {
        // Nodemailer Configuration
        const transporter = nodemailer.createTransport({
          service: "Gmail", // Replace with your email service
          auth: {
            user: process.env.EMAIL_USER, // Admin email in .env
            pass: process.env.EMAIL_PASS, // Admin email password in .env
          },
        });

        // Email Content
        const mailOptions = {
          from: process.env.EMAIL_USER, // Admin's email
          to: process.env.EMAIL_USER, // Admin's email address
          replyTo: userEmail, // User's email for reply-to
          subject: `New Service Order - ${serviceName}`,
          html: `
            <h3>New Order Details</h3>
            <p><strong>User Name:</strong> ${userName}</p>
            <p><strong>User Email:</strong> ${userEmail}</p>
            <p><strong>Service Name:</strong> ${serviceName}</p>
            <p><strong>Price:</strong> ${price} TK</p>
            <p>Please review the order and proceed accordingly.</p>
            <br>
            <p>Thank you,<br>Motoshed Team</p>
          `,
        };

        // Send Email
        await transporter.sendMail(mailOptions);

        // Respond to the client
        res
          .status(200)
          .json({ message: "Order details sent to admin successfully!" });
      } catch (error) {
        console.error("Error sending order details:", error);
        res
          .status(500)
          .json({ message: "Failed to send order details", error });
      }
    });

    // for user to admin product  to admin
    app.post("/send-product-details", async (req, res) => {
      const { userName, userEmail, products, totalPrice, location, number } =
        req.body;

      if (
        !userName ||
        !userEmail ||
        !products ||
        !totalPrice ||
        !location ||
        !number
      ) {
        return res.status(400).json({
          message:
            "User name, email, products, total price, location, and number are required.",
        });
      }

      try {
        const transporter = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const productList = products
          .map(
            (product) =>
              `<li><strong>${product.title}</strong> - Price: ${product.price} TK, Quantity: ${product.quantity}</li>`
          )
          .join("");

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `New Order from ${userName}`,
          html: `
            <h2>New Order Details</h2>
            <p><strong>Name:</strong> ${userName}</p>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Phone Number:</strong> ${number}</p>
            <p><strong>Location:</strong> ${location}</p>
            <p><strong>Total Price:</strong> ${totalPrice} TK</p>
            <p><strong>Products:</strong></p>
            <ul>${productList}</ul>
            <br />
            <p>Thank you,<br>Motoshed Team</p>
          `,
        };

        await transporter.sendMail(mailOptions);

        res
          .status(200)
          .json({ message: "Order email sent to admin successfully!" });
      } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({
          message: "Failed to send order email to admin.",
          error: error.message,
        });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// mongo end

app.get("/", (req, res) => {
  res.send("motoshed server is working");
});

app.listen(port, () => {
  console.log(`motoshed server is working properly in port${port}`);
});
