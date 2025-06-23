// Simple check to verify analytics service is loaded
const path = require('path');
const AnalyticsService = require('../services/analyticsService');

console.log('Analytics Service Check');
console.log('=====================\n');

try {
  // Check if AnalyticsService is loaded
  console.log('✓ AnalyticsService module loaded successfully');
  console.log('  Class name:', AnalyticsService.name);
  console.log('  Methods available:');
  
  const methods = Object.getOwnPropertyNames(AnalyticsService.prototype)
    .filter(name => name !== 'constructor' && typeof AnalyticsService.prototype[name] === 'function');
  
  methods.forEach(method => {
    console.log(`    - ${method}`);
  });
  
  console.log('\n✓ Analytics service is ready for use');
  console.log('\nTo test the API endpoints, you need to:');
  console.log('1. Login as an admin user');
  console.log('2. Use the returned JWT token to access:');
  console.log('   - GET /api/admin/analytics/system');
  console.log('   - GET /api/admin/analytics/users');
  console.log('   - GET /api/admin/analytics/user/:userId');
  console.log('   - GET /api/admin/analytics/export');
  
} catch (error) {
  console.error('✗ Failed to load AnalyticsService:', error.message);
}