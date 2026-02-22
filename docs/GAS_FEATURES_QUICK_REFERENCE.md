# Gas Features - Quick Reference Guide

## 🚀 Quick Start

### Access Gas Features (Web App)

1. **Navigate to Gas Readings**
   - Click "Gas Readings" in sidebar menu
   - URL: `/gas/readings`

2. **Navigate to Gas Analytics**
   - Click "Gas Analytics" in sidebar menu
   - URL: `/gas/analytics`

---

## 📊 Gas Readings Page

### Features
- View all gas meter readings (newest first)
- Add new reading
- Delete readings
- Export to CSV

### How to Add a Reading

1. Click **"+ Add Reading"** button
2. Enter **Counter Value** (e.g., 1234.567)
   - Accepts up to 3 decimal places
   - Must be a positive number
3. Choose date/time:
   - **Option A** (Default): "Use current date & time" toggle ON
     - Automatically uses today's date and current time
   - **Option B**: Toggle OFF to select specific date/time
     - Date picker: Can't select future dates
     - Time picker: 24-hour format
4. Click **"Add Reading"** to submit
5. New reading appears at top of list

### Consumption Calculation
- Each reading shows consumption from previous reading
- **Consumption** = Current counter - Previous counter (m³)
- **Period** = Days between readings
- **Daily Average** = Consumption ÷ Period (m³/day)

Example:
```
Today: 1234.567 m³
(Previous was 1232.100 m³ from 2 days ago)

Consumption = 1234.567 - 1232.100 = 2.467 m³
Period = 2 days
Daily Average = 2.467 ÷ 2 = 1.23 m³/day
```

### How to Delete a Reading

1. Click **"Delete"** button on any reading card
2. Confirm deletion in popup dialog
3. Reading removed from list

### How to Export to CSV

1. Click **"📥 Export to CSV"** button (top right)
2. File downloads as `gas-readings-YYYY-MM-DD.csv`
3. Contains: Counter Value, Reading Date, Created At
4. Open in Excel or text editor

### Tips
- Sort by newest: Already done (appears automatically)
- See consumption difference: Bottom blue box on each card
- Dark mode: Toggle sun/moon in top-right corner

---

## 📈 Gas Analytics Page

### Statistics Displayed

#### Summary Cards (Top Row)
- **Total Consumption**: Sum of all m³ used
- **Avg Daily Usage**: Average per day (m³/day)
- **Min Daily**: Lowest daily consumption
- **Max Daily**: Highest daily consumption

#### Detailed Metrics (Middle Row)
- **Median Daily**: Middle value of daily consumption
- **Std Deviation**: How consistent usage is
- **Trend**: Increasing/Decreasing/Stable with % change

#### Chart (Large Area)
- **Type**: Column chart (bar graph)
- **X-axis**: Dates
- **Y-axis**: Daily consumption (m³)
- **Filters**: By selected period

#### Recent Readings (Bottom)
- Last 5 readings with counter values
- Shows consumption change from previous reading

### Period Selector

Click dropdown to change time range:
- **Last 7 days** - Weekly trend
- **Last 14 days** - 2-week trend
- **Last 30 days** - Monthly trend (default)
- **Last 90 days** - Quarterly trend
- **Last 365 days** - Annual trend

All calculations and chart update automatically.

### Understanding Trend Indicator

**Increasing** 📈 (Red)
- Usage going up compared to earlier period
- >5% increase indicates real trend

**Decreasing** 📉 (Green)
- Usage going down compared to earlier period
- >5% decrease indicates real trend

**Stable** ➡️ (Blue)
- Usage relatively consistent
- Variation <5%

### Tips
- Compare different periods to see seasonal trends
- High std deviation = inconsistent usage
- If trending up: Check for leaks or high-demand periods

---

## 🔔 Mobile Notifications (Phase 1)

### Daily Gas Reading Reminder

**When**: 6:30 AM UTC daily

**What**: Push notification saying "Remember to record your gas meter reading"

**Action**:
1. Tap notification
2. App opens automatically
3. Navigates to Gas Readings screen
4. Modal opens to add new reading immediately

### Tips
- Set local time: 6:30 UTC = varies by timezone
  - London: 6:30 AM GMT / 7:30 AM BST
  - US East: 1:30 AM EST / 2:30 AM EDT
  - US West: 10:30 PM PST (previous day)
- Notification requires mobile app installed
- Deep link: `myapp://gas/add-reading`

---

## 📱 Mobile Gas Features

### GasReadingsScreen
- List of all readings (mobile version)
- Same add/delete functionality as web
- Swipe to delete (or delete button)
- Touch-friendly interface

### GasAnalyticsScreen
- Mobile-optimized charts
- Same statistics as web version
- Scrollable dashboard
- Responsive design

### Sync Between Platforms
- Web and mobile share same backend API
- Readings added on web appear on mobile
- Readings added on mobile appear on web
- Real-time sync (refresh to see latest)

---

## 🛠️ Troubleshooting

### "Add Reading" Button Not Working
- Check if form is open (modal should appear)
- Verify counter value is a valid number
- Check browser console for errors
- Ensure you're logged in

### Chart Not Showing
- Change period selector (may update it)
- Refresh page (F5)
- Check if readings exist in "Recent Readings" section
- Verify browser supports modern JavaScript

### Consumption Calculation Wrong
- Verify previous reading was recorded correctly
- Check date difference calculation
  - Must be >0 days to show consumption
  - Time doesn't affect day count
- Example: Same day readings = 0 days = no consumption

### Export CSV Opens as Text
- Right-click file → "Open with Excel"
- Or: Copy-paste content into Excel/Sheets
- File is standard CSV format (comma-separated)

### Dark Mode Not Working
- Click sun/moon toggle (top-right corner)
- Refresh page if needed
- Check browser supports CSS custom properties

### Notifications Not Working (Mobile)
- Ensure app has notification permission
- Check time zone (setting is in UTC)
- Verify app is installed and updated
- Check if notifications are muted in OS settings

---

## 🔐 Security & Privacy

### Data Protection
- All data encrypted in transit (HTTPS)
- JWT token required for API access
- Automatic logout after 401 error
- Tokens stored securely (localStorage for web, AsyncStorage for mobile)

### What's Visible
- Only your own readings (user-scoped)
- Analytics calculated from your data only
- No sharing with other users

### Logout
- Click "Logout" in menu
- Clears token and redirects to login
- All local data cleared

---

## 💡 Best Practices

### Taking Readings
1. **Consistent Time**: Read meter at same time each day
2. **Accurate Values**: Record exact digits including decimals
3. **Regular Schedule**: Daily or weekly readings for best analytics
4. **Notation**: Add notes if major changes occur

### Analyzing Data
1. **Look for Patterns**: When does usage peak?
2. **Seasonal Trends**: Compare winter vs summer
3. **Anomalies**: Large jumps might indicate leaks
4. **Baselines**: Track "normal" daily consumption

### Data Export
1. **Backup**: Regularly export CSV for backup
2. **Reporting**: Use CSV for custom reports
3. **Sharing**: Export to show to family/contractors

---

## 📊 Data Format Reference

### Counter Value
- **Format**: Decimal number (e.g., 1234.567)
- **Precision**: Up to 3 decimal places
- **Unit**: Cubic meters (m³)
- **Range**: Positive numbers only

### Reading Date
- **Format**: ISO 8601 (e.g., 2024-01-15T14:30:00Z)
- **Display**: Formatted as "MMM DD, YYYY HH:mm" (e.g., "Jan 15, 2024 14:30")
- **No Future Dates**: Can't add readings with future dates

### Consumption
- **Unit**: m³ (cubic meters)
- **Calculation**: Difference between consecutive readings
- **Negative Values**: Shouldn't occur (meter doesn't go backwards)

### Daily Average
- **Unit**: m³/day
- **Calculation**: Consumption ÷ (days between readings)
- **Precision**: Rounded to 2 decimal places

---

## 🌙 Dark Mode Support

### Activation
- Click sun/moon icon in top-right corner
- Toggle between light and dark mode
- Setting persists across sessions

### What Changes
- Background colors (light white → dark gray)
- Text colors (dark gray → light white)
- Card backgrounds and borders
- Chart colors adapt to theme

### Supported Platforms
- ✅ Web app (full support)
- ✅ Mobile app (full support)
- ✅ All components (Ant Design + Tailwind)

---

## 📞 Support

### Common Issues
1. **Sync Issues**: Refresh page to fetch latest data
2. **Form Errors**: Check validation messages on form
3. **API Errors**: Check backend is running
4. **Performance**: Clear browser cache if slow

### Getting Help
1. Check this guide for your issue
2. Review error messages in browser console
3. Verify all prerequisites are met
4. Check backend is accessible at http://localhost:3020/api

### Reporting Issues
Include:
- Browser name/version
- Steps to reproduce
- Error message (if any)
- Screenshot of issue
- Affected feature (web/mobile)

---

## 🎯 Feature Summary

| Feature | Web | Mobile | Notes |
|---------|-----|--------|-------|
| View Readings | ✅ | ✅ | List sorted newest first |
| Add Reading | ✅ | ✅ | Modal form with validation |
| Delete Reading | ✅ | ✅ | Requires confirmation |
| Consumption Calc | ✅ | ✅ | Auto-calculated |
| Export CSV | ✅ | ❌ | Web only |
| Analytics Dashboard | ✅ | ✅ | Full statistics + chart |
| Trend Detection | ✅ | ✅ | Auto-analyzed |
| Daily Reminder | ❌ | ✅ | 6:30 AM UTC |
| Deep Link | ❌ | ✅ | `myapp://gas/add-reading` |
| Dark Mode | ✅ | ✅ | Toggle in app |
| Responsive | ✅ | ✅ | Auto-adapts to screen size |

---

## ✅ Checklist for Getting Started

- [ ] Log in to web app
- [ ] Add first gas meter reading
- [ ] View reading in Gas Readings page
- [ ] Check consumption calculation
- [ ] Export to CSV
- [ ] Navigate to Gas Analytics
- [ ] Review statistics and chart
- [ ] Try different time periods
- [ ] Toggle dark mode
- [ ] Check mobile app sync
- [ ] Set up mobile notification (if using)

---

## 📝 Notes

- All times are stored in UTC internally
- Display times adjust to browser timezone
- Calculations use 24-hour day increments
- No fractional days in calculations
- Mobile notifications independent of web app

---

**Last Updated**: Phase 2 Complete
**Status**: Production Ready ✅
