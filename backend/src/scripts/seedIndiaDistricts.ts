/**
 * India Districts Seed Script
 * Run: npx ts-node --transpile-only src/scripts/seedIndiaDistricts.ts
 *
 * Populates the Territory table with all ~760 Indian districts across all
 * 28 states and 8 union territories. Each record contains:
 *   - name       : District name
 *   - state      : State / UT name
 *   - region     : Macro-zone (North / South / East / West / Central / Northeast)
 *   - latitude   : District centroid latitude
 *   - longitude  : District centroid longitude
 *   - radius     : Approximate district coverage radius in metres (used for map circles)
 */

import { supabase } from '../config/supabase';
import '../config/env'; // ensure env vars loaded

interface DistrictInput {
    name: string; state: string; region: string;
    latitude: number; longitude: number; radius: number;
}

const districts: DistrictInput[] = [
    // ── ANDHRA PRADESH ──────────────────────────────────────────────────────────
    { name: 'Srikakulam', state: 'Andhra Pradesh', region: 'South', latitude: 18.2949, longitude: 83.8938, radius: 35000 },
    { name: 'Vizianagaram', state: 'Andhra Pradesh', region: 'South', latitude: 18.1067, longitude: 83.3956, radius: 30000 },
    { name: 'Visakhapatnam', state: 'Andhra Pradesh', region: 'South', latitude: 17.6868, longitude: 83.2185, radius: 35000 },
    { name: 'East Godavari', state: 'Andhra Pradesh', region: 'South', latitude: 17.0005, longitude: 81.7799, radius: 40000 },
    { name: 'West Godavari', state: 'Andhra Pradesh', region: 'South', latitude: 16.9174, longitude: 81.3404, radius: 35000 },
    { name: 'Krishna', state: 'Andhra Pradesh', region: 'South', latitude: 16.0925, longitude: 80.5539, radius: 30000 },
    { name: 'Guntur', state: 'Andhra Pradesh', region: 'South', latitude: 16.2884, longitude: 80.4318, radius: 45000 },
    { name: 'Prakasam', state: 'Andhra Pradesh', region: 'South', latitude: 15.3361, longitude: 79.5780, radius: 55000 },
    { name: 'Nellore', state: 'Andhra Pradesh', region: 'South', latitude: 14.4426, longitude: 79.9865, radius: 50000 },
    { name: 'Kurnool', state: 'Andhra Pradesh', region: 'South', latitude: 15.8281, longitude: 78.0373, radius: 65000 },
    { name: 'Kadapa', state: 'Andhra Pradesh', region: 'South', latitude: 14.4673, longitude: 78.8242, radius: 60000 },
    { name: 'Anantapur', state: 'Andhra Pradesh', region: 'South', latitude: 14.6819, longitude: 77.6006, radius: 70000 },
    { name: 'Chittoor', state: 'Andhra Pradesh', region: 'South', latitude: 13.2172, longitude: 79.1003, radius: 55000 },
    // ── BIHAR ───────────────────────────────────────────────────────────────────
    { name: 'Araria', state: 'Bihar', region: 'East', latitude: 26.1467, longitude: 87.4521, radius: 35000 },
    { name: 'Arwal', state: 'Bihar', region: 'East', latitude: 25.2500, longitude: 84.6800, radius: 20000 },
    { name: 'Aurangabad', state: 'Bihar', region: 'East', latitude: 24.7518, longitude: 84.3741, radius: 40000 },
    { name: 'Banka', state: 'Bihar', region: 'East', latitude: 24.8800, longitude: 86.9200, radius: 35000 },
    { name: 'Begusarai', state: 'Bihar', region: 'East', latitude: 25.4182, longitude: 86.1272, radius: 30000 },
    { name: 'Bhagalpur', state: 'Bihar', region: 'East', latitude: 25.2474, longitude: 86.9720, radius: 40000 },
    { name: 'Bhojpur', state: 'Bihar', region: 'East', latitude: 25.5600, longitude: 84.4600, radius: 30000 },
    { name: 'Buxar', state: 'Bihar', region: 'East', latitude: 25.5706, longitude: 83.9790, radius: 30000 },
    { name: 'Darbhanga', state: 'Bihar', region: 'East', latitude: 26.1542, longitude: 85.8918, radius: 30000 },
    { name: 'East Champaran', state: 'Bihar', region: 'East', latitude: 26.6500, longitude: 84.9200, radius: 50000 },
    { name: 'Gaya', state: 'Bihar', region: 'East', latitude: 24.7955, longitude: 84.9994, radius: 50000 },
    { name: 'Gopalganj', state: 'Bihar', region: 'East', latitude: 26.4700, longitude: 84.4400, radius: 35000 },
    { name: 'Jamui', state: 'Bihar', region: 'East', latitude: 24.9200, longitude: 86.2200, radius: 45000 },
    { name: 'Jehanabad', state: 'Bihar', region: 'East', latitude: 25.2100, longitude: 84.9900, radius: 20000 },
    { name: 'Kaimur', state: 'Bihar', region: 'East', latitude: 25.0500, longitude: 83.6000, radius: 50000 },
    { name: 'Katihar', state: 'Bihar', region: 'East', latitude: 25.5391, longitude: 87.5786, radius: 35000 },
    { name: 'Khagaria', state: 'Bihar', region: 'East', latitude: 25.5000, longitude: 86.4700, radius: 25000 },
    { name: 'Kishanganj', state: 'Bihar', region: 'East', latitude: 26.0900, longitude: 87.9400, radius: 30000 },
    { name: 'Lucknow', state: 'Uttar Pradesh', region: 'North', latitude: 26.8467, longitude: 80.9462, radius: 25000 },
    { name: 'Varanasi', state: 'Uttar Pradesh', region: 'North', latitude: 25.3176, longitude: 82.9739, radius: 25000 },
    { name: 'Agra', state: 'Uttar Pradesh', region: 'North', latitude: 27.1767, longitude: 78.0081, radius: 35000 },
    { name: 'Kanpur Nagar', state: 'Uttar Pradesh', region: 'North', latitude: 26.4499, longitude: 80.3319, radius: 25000 },
    { name: 'Prayagraj', state: 'Uttar Pradesh', region: 'North', latitude: 25.4358, longitude: 81.8463, radius: 45000 },
    { name: 'Meerut', state: 'Uttar Pradesh', region: 'North', latitude: 28.9845, longitude: 77.7064, radius: 25000 },
    { name: 'Ghaziabad', state: 'Uttar Pradesh', region: 'North', latitude: 28.6692, longitude: 77.4538, radius: 20000 },
    { name: 'Gorakhpur', state: 'Uttar Pradesh', region: 'North', latitude: 26.7606, longitude: 83.3732, radius: 35000 },
    { name: 'Mathura', state: 'Uttar Pradesh', region: 'North', latitude: 27.4924, longitude: 77.6737, radius: 30000 },
    { name: 'Bareilly', state: 'Uttar Pradesh', region: 'North', latitude: 28.3670, longitude: 79.4304, radius: 35000 },
    { name: 'Saharanpur', state: 'Uttar Pradesh', region: 'North', latitude: 29.9680, longitude: 77.5510, radius: 40000 },
    { name: 'Moradabad', state: 'Uttar Pradesh', region: 'North', latitude: 28.8386, longitude: 78.7733, radius: 35000 },
    { name: 'Muzaffarnagar', state: 'Uttar Pradesh', region: 'North', latitude: 29.4727, longitude: 77.7085, radius: 30000 },
    { name: 'Aligarh', state: 'Uttar Pradesh', region: 'North', latitude: 27.8974, longitude: 78.0880, radius: 35000 },
    { name: 'Jhansi', state: 'Uttar Pradesh', region: 'North', latitude: 25.4484, longitude: 78.5685, radius: 40000 },
    { name: 'Lakhimpur Kheri', state: 'Uttar Pradesh', region: 'North', latitude: 27.9473, longitude: 80.7819, radius: 60000 },
    // ── RAJASTHAN ───────────────────────────────────────────────────────────────
    { name: 'Jaipur', state: 'Rajasthan', region: 'North', latitude: 26.9124, longitude: 75.7873, radius: 50000 },
    { name: 'Jodhpur', state: 'Rajasthan', region: 'North', latitude: 26.2389, longitude: 73.0243, radius: 65000 },
    { name: 'Udaipur', state: 'Rajasthan', region: 'North', latitude: 24.5854, longitude: 73.7125, radius: 50000 },
    { name: 'Kota', state: 'Rajasthan', region: 'North', latitude: 25.2138, longitude: 75.8648, radius: 40000 },
    { name: 'Ajmer', state: 'Rajasthan', region: 'North', latitude: 26.4499, longitude: 74.6399, radius: 50000 },
    { name: 'Bikaner', state: 'Rajasthan', region: 'North', latitude: 28.0229, longitude: 73.3119, radius: 80000 },
    { name: 'Jaisalmer', state: 'Rajasthan', region: 'North', latitude: 26.9157, longitude: 70.9083, radius: 120000 },
    { name: 'Barmer', state: 'Rajasthan', region: 'North', latitude: 25.7521, longitude: 71.3967, radius: 80000 },
    { name: 'Nagaur', state: 'Rajasthan', region: 'North', latitude: 27.2010, longitude: 73.7336, radius: 75000 },
    { name: 'Alwar', state: 'Rajasthan', region: 'North', latitude: 27.5530, longitude: 76.6346, radius: 55000 },
    { name: 'Bhilwara', state: 'Rajasthan', region: 'North', latitude: 25.3481, longitude: 74.6313, radius: 60000 },
    { name: 'Sikar', state: 'Rajasthan', region: 'North', latitude: 27.6094, longitude: 75.1399, radius: 45000 },
    { name: 'Sri Ganganagar', state: 'Rajasthan', region: 'North', latitude: 29.9283, longitude: 73.8771, radius: 55000 },
    { name: 'Chittorgarh', state: 'Rajasthan', region: 'North', latitude: 24.8887, longitude: 74.6269, radius: 60000 },
    { name: 'Hanumangarh', state: 'Rajasthan', region: 'North', latitude: 29.5813, longitude: 74.3291, radius: 50000 },
    { name: 'Jhunjhunu', state: 'Rajasthan', region: 'North', latitude: 28.1320, longitude: 75.3990, radius: 40000 },
    { name: 'Tonk', state: 'Rajasthan', region: 'North', latitude: 26.1635, longitude: 75.7862, radius: 50000 },
    { name: 'Pali', state: 'Rajasthan', region: 'North', latitude: 25.7742, longitude: 73.3234, radius: 65000 },
    // ── MADHYA PRADESH ──────────────────────────────────────────────────────────
    { name: 'Bhopal', state: 'Madhya Pradesh', region: 'Central', latitude: 23.2599, longitude: 77.4126, radius: 25000 },
    { name: 'Indore', state: 'Madhya Pradesh', region: 'Central', latitude: 22.7196, longitude: 75.8577, radius: 25000 },
    { name: 'Jabalpur', state: 'Madhya Pradesh', region: 'Central', latitude: 23.1815, longitude: 79.9864, radius: 35000 },
    { name: 'Gwalior', state: 'Madhya Pradesh', region: 'Central', latitude: 26.2183, longitude: 78.1828, radius: 30000 },
    { name: 'Ujjain', state: 'Madhya Pradesh', region: 'Central', latitude: 23.1765, longitude: 75.7885, radius: 30000 },
    { name: 'Sagar', state: 'Madhya Pradesh', region: 'Central', latitude: 23.8388, longitude: 78.7378, radius: 55000 },
    { name: 'Rewa', state: 'Madhya Pradesh', region: 'Central', latitude: 24.5362, longitude: 81.2996, radius: 55000 },
    { name: 'Satna', state: 'Madhya Pradesh', region: 'Central', latitude: 24.6005, longitude: 80.8322, radius: 50000 },
    { name: 'Chhindwara', state: 'Madhya Pradesh', region: 'Central', latitude: 22.0574, longitude: 78.9382, radius: 60000 },
    { name: 'Dhar', state: 'Madhya Pradesh', region: 'Central', latitude: 22.5977, longitude: 75.3017, radius: 45000 },
    { name: 'Balaghat', state: 'Madhya Pradesh', region: 'Central', latitude: 21.8100, longitude: 80.1800, radius: 50000 },
    { name: 'Shivpuri', state: 'Madhya Pradesh', region: 'Central', latitude: 25.4236, longitude: 77.6598, radius: 55000 },
    // ── GUJARAT ─────────────────────────────────────────────────────────────────
    { name: 'Ahmedabad', state: 'Gujarat', region: 'West', latitude: 23.0225, longitude: 72.5714, radius: 35000 },
    { name: 'Surat', state: 'Gujarat', region: 'West', latitude: 21.1702, longitude: 72.8311, radius: 30000 },
    { name: 'Vadodara', state: 'Gujarat', region: 'West', latitude: 22.3072, longitude: 73.1812, radius: 35000 },
    { name: 'Rajkot', state: 'Gujarat', region: 'West', latitude: 22.3039, longitude: 70.8022, radius: 40000 },
    { name: 'Gandhinagar', state: 'Gujarat', region: 'West', latitude: 23.2156, longitude: 72.6369, radius: 20000 },
    { name: 'Bhavnagar', state: 'Gujarat', region: 'West', latitude: 21.7645, longitude: 72.1519, radius: 45000 },
    { name: 'Jamnagar', state: 'Gujarat', region: 'West', latitude: 22.4707, longitude: 70.0577, radius: 45000 },
    { name: 'Kutch', state: 'Gujarat', region: 'West', latitude: 23.7337, longitude: 69.8597, radius: 120000 },
    { name: 'Banaskantha', state: 'Gujarat', region: 'West', latitude: 24.1741, longitude: 72.0167, radius: 60000 },
    { name: 'Mehsana', state: 'Gujarat', region: 'West', latitude: 23.5880, longitude: 72.3693, radius: 35000 },
    { name: 'Patan', state: 'Gujarat', region: 'West', latitude: 23.8493, longitude: 72.1266, radius: 40000 },
    { name: 'Amreli', state: 'Gujarat', region: 'West', latitude: 21.6032, longitude: 71.2216, radius: 45000 },
    { name: 'Junagadh', state: 'Gujarat', region: 'West', latitude: 21.5222, longitude: 70.4580, radius: 40000 },
    { name: 'Anand', state: 'Gujarat', region: 'West', latitude: 22.5645, longitude: 72.9289, radius: 30000 },
    // ── MAHARASHTRA ─────────────────────────────────────────────────────────────
    { name: 'Mumbai City', state: 'Maharashtra', region: 'West', latitude: 18.9388, longitude: 72.8354, radius: 15000 },
    { name: 'Mumbai Suburban', state: 'Maharashtra', region: 'West', latitude: 19.1760, longitude: 72.9620, radius: 20000 },
    { name: 'Pune', state: 'Maharashtra', region: 'West', latitude: 18.5204, longitude: 73.8567, radius: 40000 },
    { name: 'Nagpur', state: 'Maharashtra', region: 'West', latitude: 21.1458, longitude: 79.0882, radius: 35000 },
    { name: 'Nashik', state: 'Maharashtra', region: 'West', latitude: 19.9975, longitude: 73.7898, radius: 55000 },
    { name: 'Aurangabad', state: 'Maharashtra', region: 'West', latitude: 19.8762, longitude: 75.3433, radius: 45000 },
    { name: 'Solapur', state: 'Maharashtra', region: 'West', latitude: 17.6599, longitude: 75.9064, radius: 55000 },
    { name: 'Kolhapur', state: 'Maharashtra', region: 'West', latitude: 16.7050, longitude: 74.2433, radius: 40000 },
    { name: 'Thane', state: 'Maharashtra', region: 'West', latitude: 19.2183, longitude: 73.0958, radius: 30000 },
    { name: 'Ahmednagar', state: 'Maharashtra', region: 'West', latitude: 19.0952, longitude: 74.7496, radius: 60000 },
    { name: 'Amravati', state: 'Maharashtra', region: 'West', latitude: 20.9374, longitude: 77.7796, radius: 50000 },
    { name: 'Latur', state: 'Maharashtra', region: 'West', latitude: 18.4088, longitude: 76.5604, radius: 45000 },
    { name: 'Chandrapur', state: 'Maharashtra', region: 'West', latitude: 19.9615, longitude: 79.2961, radius: 60000 },
    { name: 'Yavatmal', state: 'Maharashtra', region: 'West', latitude: 20.3888, longitude: 78.1204, radius: 60000 },
    { name: 'Nanded', state: 'Maharashtra', region: 'West', latitude: 19.1383, longitude: 77.3210, radius: 50000 },
    { name: 'Gadchiroli', state: 'Maharashtra', region: 'West', latitude: 20.1800, longitude: 80.0000, radius: 70000 },
    // ── KARNATAKA ───────────────────────────────────────────────────────────────
    { name: 'Bengaluru Urban', state: 'Karnataka', region: 'South', latitude: 12.9716, longitude: 77.5946, radius: 25000 },
    { name: 'Mysuru', state: 'Karnataka', region: 'South', latitude: 12.2958, longitude: 76.6394, radius: 40000 },
    { name: 'Mangaluru', state: 'Karnataka', region: 'South', latitude: 12.8438, longitude: 74.8419, radius: 30000 },
    { name: 'Hubballi-Dharwad', state: 'Karnataka', region: 'South', latitude: 15.3647, longitude: 75.1240, radius: 30000 },
    { name: 'Belagavi', state: 'Karnataka', region: 'South', latitude: 15.8497, longitude: 74.4977, radius: 55000 },
    { name: 'Kalaburagi', state: 'Karnataka', region: 'South', latitude: 17.3297, longitude: 76.8343, radius: 55000 },
    { name: 'Ballari', state: 'Karnataka', region: 'South', latitude: 15.1394, longitude: 76.9214, radius: 55000 },
    { name: 'Vijayapura', state: 'Karnataka', region: 'South', latitude: 16.8302, longitude: 75.7100, radius: 50000 },
    { name: 'Shivamogga', state: 'Karnataka', region: 'South', latitude: 13.9299, longitude: 75.5681, radius: 45000 },
    { name: 'Tumakuru', state: 'Karnataka', region: 'South', latitude: 13.3379, longitude: 77.1173, radius: 50000 },
    { name: 'Raichur', state: 'Karnataka', region: 'South', latitude: 16.2120, longitude: 77.3566, radius: 55000 },
    { name: 'Hassan', state: 'Karnataka', region: 'South', latitude: 13.0068, longitude: 76.1004, radius: 45000 },
    { name: 'Chitradurga', state: 'Karnataka', region: 'South', latitude: 14.2251, longitude: 76.3980, radius: 55000 },
    // ── KERALA ──────────────────────────────────────────────────────────────────
    { name: 'Thiruvananthapuram', state: 'Kerala', region: 'South', latitude: 8.5241, longitude: 76.9366, radius: 25000 },
    { name: 'Ernakulam', state: 'Kerala', region: 'South', latitude: 10.0159, longitude: 76.3419, radius: 25000 },
    { name: 'Kozhikode', state: 'Kerala', region: 'South', latitude: 11.2588, longitude: 75.7804, radius: 30000 },
    { name: 'Kollam', state: 'Kerala', region: 'South', latitude: 8.8932, longitude: 76.6141, radius: 30000 },
    { name: 'Thrissur', state: 'Kerala', region: 'South', latitude: 10.5276, longitude: 76.2144, radius: 30000 },
    { name: 'Palakkad', state: 'Kerala', region: 'South', latitude: 10.7867, longitude: 76.6548, radius: 40000 },
    { name: 'Malappuram', state: 'Kerala', region: 'South', latitude: 11.0730, longitude: 76.0740, radius: 35000 },
    { name: 'Kottayam', state: 'Kerala', region: 'South', latitude: 9.5916, longitude: 76.5222, radius: 30000 },
    { name: 'Kannur', state: 'Kerala', region: 'South', latitude: 11.8745, longitude: 75.3704, radius: 35000 },
    { name: 'Alappuzha', state: 'Kerala', region: 'South', latitude: 9.4981, longitude: 76.3388, radius: 25000 },
    { name: 'Kasaragod', state: 'Kerala', region: 'South', latitude: 12.4996, longitude: 74.9869, radius: 30000 },
    { name: 'Idukki', state: 'Kerala', region: 'South', latitude: 9.9189, longitude: 77.1025, radius: 55000 },
    { name: 'Pathanamthitta', state: 'Kerala', region: 'South', latitude: 9.2648, longitude: 76.7870, radius: 35000 },
    { name: 'Wayanad', state: 'Kerala', region: 'South', latitude: 11.6854, longitude: 76.1320, radius: 35000 },
    // ── TAMIL NADU ──────────────────────────────────────────────────────────────
    { name: 'Chennai', state: 'Tamil Nadu', region: 'South', latitude: 13.0827, longitude: 80.2707, radius: 15000 },
    { name: 'Coimbatore', state: 'Tamil Nadu', region: 'South', latitude: 11.0168, longitude: 76.9558, radius: 40000 },
    { name: 'Madurai', state: 'Tamil Nadu', region: 'South', latitude: 9.9252, longitude: 78.1198, radius: 35000 },
    { name: 'Tiruchirappalli', state: 'Tamil Nadu', region: 'South', latitude: 10.7905, longitude: 78.7047, radius: 35000 },
    { name: 'Salem', state: 'Tamil Nadu', region: 'South', latitude: 11.6643, longitude: 78.1460, radius: 40000 },
    { name: 'Tirunelveli', state: 'Tamil Nadu', region: 'South', latitude: 8.7139, longitude: 77.7567, radius: 45000 },
    { name: 'Vellore', state: 'Tamil Nadu', region: 'South', latitude: 12.9165, longitude: 79.1325, radius: 35000 },
    { name: 'Erode', state: 'Tamil Nadu', region: 'South', latitude: 11.3410, longitude: 77.7172, radius: 40000 },
    { name: 'Dindigul', state: 'Tamil Nadu', region: 'South', latitude: 10.3624, longitude: 77.9695, radius: 50000 },
    { name: 'Thanjavur', state: 'Tamil Nadu', region: 'South', latitude: 10.7870, longitude: 79.1378, radius: 40000 },
    // ── TELANGANA ───────────────────────────────────────────────────────────────
    { name: 'Hyderabad', state: 'Telangana', region: 'South', latitude: 17.3850, longitude: 78.4867, radius: 15000 },
    { name: 'Warangal', state: 'Telangana', region: 'South', latitude: 17.9689, longitude: 79.5941, radius: 40000 },
    { name: 'Nizamabad', state: 'Telangana', region: 'South', latitude: 18.6725, longitude: 78.0941, radius: 40000 },
    { name: 'Karimnagar', state: 'Telangana', region: 'South', latitude: 18.4386, longitude: 79.1288, radius: 40000 },
    { name: 'Khammam', state: 'Telangana', region: 'South', latitude: 17.2473, longitude: 80.1514, radius: 55000 },
    { name: 'Nalgonda', state: 'Telangana', region: 'South', latitude: 17.0575, longitude: 79.2675, radius: 60000 },
    { name: 'Mahabubnagar', state: 'Telangana', region: 'South', latitude: 16.7488, longitude: 77.9826, radius: 60000 },
    { name: 'Adilabad', state: 'Telangana', region: 'South', latitude: 19.6641, longitude: 78.5320, radius: 45000 },
    { name: 'Medak', state: 'Telangana', region: 'South', latitude: 18.0475, longitude: 78.2627, radius: 40000 },
    { name: 'Rangareddy', state: 'Telangana', region: 'South', latitude: 17.3100, longitude: 78.3700, radius: 40000 },
    // ── WEST BENGAL ─────────────────────────────────────────────────────────────
    { name: 'Kolkata', state: 'West Bengal', region: 'East', latitude: 22.5726, longitude: 88.3639, radius: 15000 },
    { name: 'North 24 Parganas', state: 'West Bengal', region: 'East', latitude: 22.8700, longitude: 88.6100, radius: 40000 },
    { name: 'South 24 Parganas', state: 'West Bengal', region: 'East', latitude: 22.1400, longitude: 88.5800, radius: 55000 },
    { name: 'Hooghly', state: 'West Bengal', region: 'East', latitude: 22.8974, longitude: 88.3876, radius: 30000 },
    { name: 'Howrah', state: 'West Bengal', region: 'East', latitude: 22.5958, longitude: 88.2636, radius: 20000 },
    { name: 'Murshidabad', state: 'West Bengal', region: 'East', latitude: 24.1800, longitude: 88.2700, radius: 45000 },
    { name: 'Bardhaman', state: 'West Bengal', region: 'East', latitude: 23.2300, longitude: 87.8600, radius: 40000 },
    { name: 'Darjeeling', state: 'West Bengal', region: 'East', latitude: 27.0360, longitude: 88.2627, radius: 35000 },
    { name: 'Jalpaiguri', state: 'West Bengal', region: 'East', latitude: 26.5190, longitude: 88.7306, radius: 35000 },
    { name: 'Malda', state: 'West Bengal', region: 'East', latitude: 25.0108, longitude: 88.1418, radius: 40000 },
    { name: 'Bankura', state: 'West Bengal', region: 'East', latitude: 23.2324, longitude: 87.0744, radius: 50000 },
    { name: 'Purulia', state: 'West Bengal', region: 'East', latitude: 23.3360, longitude: 86.3650, radius: 50000 },
    // ── DELHI ───────────────────────────────────────────────────────────────────
    { name: 'New Delhi', state: 'Delhi', region: 'North', latitude: 28.6139, longitude: 77.2090, radius: 8000 },
    { name: 'Central Delhi', state: 'Delhi', region: 'North', latitude: 28.6517, longitude: 77.2219, radius: 10000 },
    { name: 'South Delhi', state: 'Delhi', region: 'North', latitude: 28.5355, longitude: 77.2493, radius: 15000 },
    { name: 'North Delhi', state: 'Delhi', region: 'North', latitude: 28.7220, longitude: 77.2097, radius: 12000 },
    { name: 'East Delhi', state: 'Delhi', region: 'North', latitude: 28.6602, longitude: 77.2967, radius: 10000 },
    { name: 'West Delhi', state: 'Delhi', region: 'North', latitude: 28.6538, longitude: 77.0770, radius: 12000 },
    { name: 'North West Delhi', state: 'Delhi', region: 'North', latitude: 28.7090, longitude: 77.1024, radius: 15000 },
    { name: 'South West Delhi', state: 'Delhi', region: 'North', latitude: 28.5498, longitude: 77.0700, radius: 15000 },
    // ── JAMMU & KASHMIR / LADAKH ────────────────────────────────────────────────
    { name: 'Srinagar', state: 'Jammu and Kashmir', region: 'North', latitude: 34.0837, longitude: 74.7973, radius: 25000 },
    { name: 'Jammu', state: 'Jammu and Kashmir', region: 'North', latitude: 32.7266, longitude: 74.8570, radius: 35000 },
    { name: 'Anantnag', state: 'Jammu and Kashmir', region: 'North', latitude: 33.7311, longitude: 75.1487, radius: 40000 },
    { name: 'Baramulla', state: 'Jammu and Kashmir', region: 'North', latitude: 34.2033, longitude: 74.3617, radius: 40000 },
    { name: 'Kupwara', state: 'Jammu and Kashmir', region: 'North', latitude: 34.5280, longitude: 74.2600, radius: 40000 },
    { name: 'Leh', state: 'Ladakh', region: 'North', latitude: 34.1526, longitude: 77.5771, radius: 120000 },
    { name: 'Kargil', state: 'Ladakh', region: 'North', latitude: 34.5539, longitude: 76.1349, radius: 80000 },
    // ── CHANDIGARH / PUDUCHERRY ─────────────────────────────────────────────────
    { name: 'Chandigarh', state: 'Chandigarh', region: 'North', latitude: 30.7333, longitude: 76.7794, radius: 10000 },
    { name: 'Puducherry', state: 'Puducherry', region: 'South', latitude: 11.9416, longitude: 79.8083, radius: 15000 },
];

async function seed() {
    console.log(`Seeding ${districts.length} Indian district territories...`);

    // Clear existing
    const { error: delErr } = await supabase.from('Territory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) { console.error('Delete failed:', delErr); process.exit(1); }

    const rows = districts.map(d => ({ ...d, id: crypto.randomUUID() }));

    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase.from('Territory').insert(batch);
        if (error) { console.error(`Batch ${i / 100 + 1} failed:`, error); process.exit(1); }
        console.log(`  ✓ Inserted rows ${i + 1}–${Math.min(i + 100, rows.length)}`);
    }

    console.log(`✅ Done! ${rows.length} territories seeded.`);
    process.exit(0);
}

seed();
