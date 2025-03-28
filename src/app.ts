import { ItemSales, Order, status } from './types';
import { generateUBL, userExists, validItemList, addItems, validSellers } from './helper';
import { getUser, addOrder, getOrder, updateOrder, 
  addOrderXML,
  getOrderXML, getItemSellerSales
 } from './dataStore'
 import fs from 'fs';
import { stringify } from 'csv-stringify/sync';
import path from 'path';
import PDFDocument from "pdfkit";

/**
 * Create an order and produce a UBL document, and return the
 * orderId value
 *
 * @param {OrderParam} order - object containing all the order information
 * @returns {{ orderId: number }} orderId - Unique identifier for an order
 */
async function orderCreate (order: Order) {
  if (!order.buyer.id) {
    throw new Error ('No userId provided');
  }
  const user = await userExists(order.buyer.id, order.buyer.name);
  if (!user) {
    throw new Error 
    ('Invalid userId or a different name is registered to userId');
  }

  // Throw error for invalid bank details
  if (order.billingDetails.creditCardNumber.length < 12 ||
      order.billingDetails.creditCardNumber.length > 16 ||
      !/^[0-9]+$/.test(order.billingDetails.creditCardNumber)) {
    throw new Error ('Invalid bank details');
  }

  // Throw error for invalid date selection.
  const currDate = new Date().toISOString().split('T')[0];
  if (order.delivery.startDate < currDate || order.delivery.endDate < currDate
    || order.delivery.startDate > order.delivery.endDate) {
    throw new Error ('Invalid date selection');
  }

  // If an invalid amount of item quantities are provided, throw error.
  if (order.items.length !== order.quantities.length) {
    throw new Error ('Invalid amount of item quantities provided');
  }

  // Checks if sellers are valid.
  const sellersValid = await validSellers(order);
  if (!sellersValid) {
    throw new Error ('Invalid seller(s)');
  }

  // Helper function checks if all items/quantities are valid and returns the 
  // total price if so.
  const totalPrice = await validItemList(order);
  // Throw error if inputted total price is incorrect.
  if (totalPrice !== order.totalPrice) {
    throw new Error ('Incorrect total price provided');
  }

  // Helper function adds all items to item datastore.
  await addItems(order);
  order.lastEdited = currDate;
  order.status = status.PENDING;
  const orderId = await addOrder(order);

  // Helper function generates UBl document.
  if (orderId !== null) {
    const UBLDocument = generateUBL(orderId, order);
    await addOrderXML(orderId, UBLDocument);
  }
  return { orderId };
}

/**
 * Cancels an order for a given user with a specified reason.
 * 
 * @param {number} userId - The ID of the user requesting the cancellation.
 * @param {number} orderId - The ID of the order to be cancelled.
 * @param {string} reason - The reason for cancelling the order.
 * @returns {Promise<{ reason: string }>} - A confirmation object containing the cancellation reason.
 * @throws {Error} - If the user ID or order ID is invalid, the order is already cancelled, or the update fails.
 */
const orderCancel = async (userId: number, orderId: number, reason: string) => {
  // Check if userId and orderId are valid
  const user = await getUser(userId);
  if (!user) {
      throw new Error("invalid userId");
  }
  const orderData = await getOrder(orderId);
  if (!orderData) {
      throw new Error("invalid orderId");
  }

  // Check if status is already cancelled
  if (orderData.status === status.CANCELLED) {
      throw new Error("order already cancelled");
  }
  orderData.status = status.CANCELLED;

  // Update order object in database
  const updateSuccess = await updateOrder(orderData);
  if (!updateSuccess) {
      throw new Error("failed to update order status to cancelled");
  }

  return { reason };
};

/**
 * Confirms an order for a given user.
 * 
 * @param {number} userId - The ID of the user requesting the confirmation.
 * @param {number} orderId - The ID of the order to be confirmed.
 * @returns {Promise<{ UBL?: string }>} - A confirmation object containing the order's UBL data (if available).
 * @throws {Error} - If the user ID or order ID is invalid, the order is cancelled, or the update fails.
 */
const orderConfirm = async (userId: number, orderId: number) => {
  // Check if userId and orderId are valid  
  const user = await getUser(userId);
  if (!user) {
      throw new Error("invalid userId");
  }
  const orderData = await getOrder(orderId);
  if (!orderData) {
      throw new Error("invalid orderId");
  }

  // Check if order status is cancelled
  if (orderData.status === status.CANCELLED) {
    throw new Error('order has been cancelled');
  }

  if (orderData.status === status.CONFIRMED) {
      return {};
  }
  orderData.status = status.CONFIRMED;

  // Update order object in database
  const updateSuccess = await updateOrder(orderData);
  if (!updateSuccess) {
      throw new Error("failed to update order status to confirmed");
  }

  // Fetch and return XML associated with order
  const UBL = await getOrderXML(Number(orderData.orderXMLId));
  return { UBL };
};

/** Seller route to return sales information to the seller.
 *
 * @param {boolean} csv - boolean to state if the csv data option is desired.
 * @param {boolean} json - boolean to state if the json data option is desired.
 * @param {boolean} pdf - boolean to state if the pdf data option is desired.
 * @param {number | null} sellId - Unique identifier for a seller.
 * @returns { sales?: ItemSales[]; CSVurl?: string; PDFurl?: string } 
 * returnBody - an object which can contain: the csv url, json body, pdf for sales info.
 */
async function orderUserSales(csv: boolean, json: boolean, pdf: boolean, sellerId: number | null) {
  if (!csv && !json && !pdf) {
    throw new Error ('At least one data option should be selected');
  }
  if (!sellerId) {
    throw new Error ('No sellerId provided');
  }
  const seller = await getUser(sellerId);
  
  if (!seller) {
    throw new Error ('Invalid sellerId');
  }

  const returnBody: { sales?: ItemSales[]; CSVurl?: string
    ; PDFurl?: string } = {};

  const sales = await getItemSellerSales(sellerId);
  // Convert sales information to type number.
  for (const item of sales) {
    item.amountSold = Number(item.amountSold);
    item.price = Number(item.price);
  }

  // Create path to sales_report csv directory.
  const CSVdirPath = path.join(__dirname, 'sales_reports_csv');
  if (!fs.existsSync(CSVdirPath)) {
    fs.mkdirSync(CSVdirPath);
  }

  // Create path to sales_report pdf directory.
  const PDFdirPath = path.join(__dirname, 'sales_reports_pdf');
  if (!fs.existsSync(PDFdirPath)) {
    fs.mkdirSync(PDFdirPath);
  }

  if (json) {
    returnBody.sales = sales;
  }
  
  if (csv) {
    // Convert sales data from json body to a csv-format string.
    const csvString = stringify(sales, {
      header: true,
      columns: ['id', 'name', 'description', 'price', 'amountSold'],
    });
    // Create the path to the csv file
    const filePath = path.join(CSVdirPath, `sales_${sellerId}.csv`);

    // Fill the csv with sales info.
    fs.writeFileSync(filePath, csvString);
    // Place CSV url into body.
    returnBody.CSVurl = `/sales_reports_csv/sales_${sellerId}.csv`;
  }

  if (pdf) {
    // Create the new PDF document
    const doc = new PDFDocument();

    // Create the path to the csv file
    const filePath = path.join(PDFdirPath, `sales_${sellerId}.pdf`);

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Add title
    doc.fontSize(20).text("Sales Report", { align: "center" });
    doc.moveDown();

    // Add sales data to pdf.
    for (const item of sales) {
      doc.fontSize(14).text(`ID: ${item.id}`);
      doc.text(`Name: ${item.name}`);
      doc.text(`Description: ${item.description}`);
      doc.text(`Price: $${item.price}`);
      doc.text(`Amount Sold: ${item.amountSold}`);
      doc.moveDown();
    }
    doc.end();
    // Place PDF url inside body.
    returnBody.PDFurl = `/sales_reports_pdf/sales_${sellerId}.pdf`;
  }

  return returnBody;
}

export { orderCreate, orderCancel, orderConfirm, orderUserSales };
