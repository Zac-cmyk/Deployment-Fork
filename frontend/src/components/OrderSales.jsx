import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    FiDownload, 
    FiFileText, 
    FiPieChart, 
 } from 'react-icons/fi';
import '../styles/OrderSales.css';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Define your animation
const chartAnimation = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 1 } },
};

const OrderSales = () => {
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('month');
  const [format, setFormat] = useState('table');
  const [salesData, setSalesData] = useState([]);
  // const [summaryData, setSummaryData] = useState({});
  const [loading, setLoading] = useState(true);

  function decodeJWT(token) {
    if (!token) return null;
    const payload = token.split('.')[1]; // JWT format: header.payload.signature
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  }

  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  const payload = decodeJWT(token);

  

  // Calculate summary statistics
  // const calculateSummary = (data) => {
  //   const summary = {
  //     totalSales: data.reduce((sum, order) => sum + Number(order.price)*order.amountSold, 0),
  //     completedOrders: data.filter(o => o.status === 'completed').length,
  //     pendingOrders: data.filter(o => o.status === 'pending').length,
  //     averageOrder: data.length > 0 
  //       ? data.reduce((sum, order) => sum + Number(order.price)*order.amountSold, 0) / data.length 
  //       : 0
  //   };
  //   setSummaryData(summary);
  // };

  // Handle export download
  const handleExport = async (type) => {
    try {
      const response = await axios.get(
        `https://h13-redstone-goats.vercel.app/v1/order/${payload.userId}/sales`,
        {
          params: { [type]: true },
          responseType: type === 'pdf' ? 'csv' : 'json',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      console.log(response);

      if (type === 'pdf') {
        // Handle PDF download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `sales_report_${new Date().toISOString().split('T')[0]}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else if (type === 'csv') {
        // Handle CSV download
        const url = response.data.CSVurl;
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error(`Error exporting ${type}:`, error);
      alert(`Failed to export ${type.toUpperCase()} report`);
    }
  };

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        setLoading(true);
  
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  
        const response = await axios.get(
          `https://h13-redstone-goats.vercel.app/v1/order/${payload.userId}/sales`,
          {
            params: { json: true },
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        
        console.log(response.data);
        setSalesData(response.data.sales || []);
        // calculateSummary(response.data.sales || []);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error || 'Failed to load order sales');
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    };
  
    fetchSalesData();
  }, [timeRange, payload.userId]);
  
  // Function to generate a random shade of red
  const getRandomColour = () => {
    // Randomly choose a color from the red, orange, or yellow ranges
    const colorChoice = Math.floor(Math.random() * 3); // 0 = Red, 1 = Orange, 2 = Yellow

    let r, g, b;

    switch (colorChoice) {
      case 0: // Red
        r = Math.floor(Math.random() * 155) + 100; // Red from 100 to 255
        g = Math.floor(Math.random() * 100);       // Green from 0 to 100 (to avoid greenish)
        b = Math.floor(Math.random() * 100);       // Blue from 0 to 100 (to avoid blueish)
        break;
      case 1: // Orange
        r = Math.floor(Math.random() * 155) + 100; // Red from 100 to 255
        g = Math.floor(Math.random() * 150) + 50;  // Green from 50 to 200 (more saturation)
        b = Math.floor(Math.random() * 100);       // Blue from 0 to 100
        break;
      case 2: // Yellow
        r = Math.floor(Math.random() * 255);       // Red from 0 to 255 (full range)
        g = Math.floor(Math.random() * 150) + 100; // Green from 100 to 255 (to make it yellowish)
        b = Math.floor(Math.random() * 100);       // Blue from 0 to 100 (to avoid greenish tint)
        break;
      default:
        r = g = b = 0; // Should never happen, fallback
  }

  // Return RGB color string
  return `rgb(${r}, ${g}, ${b})`;
  };

  const revenueData = salesData.map((order) => ({
    name: order.name,
    value: Number(order.price) * order.amountSold,
  }));

  const amountData = salesData.map((order) => ({
    name: order.name,
    value: order.amountSold,
  }));

  return (
      <motion.div className="dashboard-container" initial="hidden" animate="visible">
    {error && (
      <div className="error-message">
        {error}
      </div>
    )}
    <main className="dashboard-main order-sales">
      <div className="sales-header">
        <h2>Order Sales</h2>
        <div className="controls">
          <div className="time-range">
            {['week', 'month', 'year'].map((range) => (
              <button
                key={range}
                className={timeRange === range ? 'active' : ''}
                onClick={() => setTimeRange(range)}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          <div className="export-options">
            <button onClick={() => handleExport('csv')}>
              <FiDownload /> CSV
            </button>
            <button onClick={() => handleExport('pdf')}>
              <FiFileText /> PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading sales data...</p>
        </div>
      ) : (
        <>
          <div className="view-options">
            {['table', 'chart'].map((view) => (
              <button
                key={view}
                className={format === view ? 'active' : ''}
                onClick={() => setFormat(view)}
              >
                {view === 'table' ? <FiFileText /> : <FiPieChart />}{" "}
                {view.charAt(0).toUpperCase() + view.slice(1)} View
              </button>
            ))}
          </div>

          {format === 'table' ? (
            <div className="sales-table-container">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Item ID</th>
                    <th>Product</th>
                    <th>Description</th>
                    <th>Amount Listed</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData?.length > 0 ? (
                    salesData.map((order) => (
                      <tr key={order.id}>
                        <td>{order.id}</td>
                        <td>{order.name}</td>
                        <td>{order.description}</td>
                        <td>{order.amountSold}</td>
                        <td>${Number(order.price).toFixed(2)}</td>
                        <td>${(Number(order.price) * order.amountSold).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7">No sales data available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="chart-placeholder">
              <div className="sales-pie-charts">
                <div className="pie-charts-row">
                  {/* Total Revenue By Items ($) Pie Chart */}
                  <div className="pie-chart-header">
                    <h3>Total Revenue By Items ($)</h3>
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={chartAnimation}
                    >
                      <ResponsiveContainer width="105%" height={300}>
                        <PieChart>
                          <Pie
                            data={revenueData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            fill="#ff4d4d" // Red shade
                            label
                          >
                            {revenueData.map((entry, index) => (
                              <Cell
                                key={`rev-${index}`}
                                fill={getRandomColour()}
                                animate={{ scale: [0.5, 1], opacity: [0, 1] }}
                                transition={{ duration: 0.8, delay: index * 0.1 }}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </motion.div>
                  </div>

                  {/* Amount Listed By Items Pie Chart */}
                  <div className="pie-chart-header">
                    <h3>Amount Listed By Items</h3>
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={chartAnimation}
                    >
                      <ResponsiveContainer width="105%" height={300}>
                        <PieChart>
                          <Pie
                            data={amountData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            fill="#ff7f7f" // Lighter red shade
                            label
                          >
                            {amountData.map((entry, index) => (
                              <Cell
                                key={`amt-${index}`}
                                fill={getRandomColour()}
                                animate={{ scale: [0.5, 1], opacity: [0, 1] }}
                                transition={{ duration: 0.8, delay: index * 0.1 }}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </motion.div>
                  </div>
                </div>
              </div>
              <p>Sales visualization for {timeRange}</p>
            </div>
          )}
        </>
      )}
    </main>
  </motion.div>
  );
};

export default OrderSales;