import { CreditCard, Download, Eye, Calendar, DollarSign, TrendingDown, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import { Badge } from '../components/ui/badge';

interface Bill {
  id: string;
  month: string;
  year: number;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
  usage: number;
  savings: number;
  paymentMethod?: string;
}

export function BillingPage() {
  // Mock billing data
  const currentBill = {
    id: 'BILL-2024-12',
    month: 'December',
    year: 2024,
    amount: 1987.45,
    dueDate: '2024-12-25',
    status: 'pending' as const,
    usage: 1245,
    savings: 342.50,
    paymentMethod: 'Auto-pay (•••• 4567)'
  };

  const billHistory: Bill[] = [
    {
      id: 'BILL-2024-11',
      month: 'November',
      year: 2024,
      amount: 2156.78,
      dueDate: '2024-11-25',
      status: 'paid',
      usage: 1387,
      savings: 298.23,
      paymentMethod: 'Auto-pay (•••• 4567)'
    },
    {
      id: 'BILL-2024-10',
      month: 'October',
      year: 2024,
      amount: 1876.32,
      dueDate: '2024-10-25',
      status: 'paid',
      usage: 1123,
      savings: 445.67,
      paymentMethod: 'Auto-pay (•••• 4567)'
    },
    {
      id: 'BILL-2024-09',
      month: 'September',
      year: 2024,
      amount: 2234.56,
      dueDate: '2024-09-25',
      status: 'paid',
      usage: 1567,
      savings: 267.89,
      paymentMethod: 'Auto-pay (•••• 4567)'
    }
  ];

  const getStatusIcon = (status: Bill['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-2">
          Billing & Payments
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your energy bills, view payment history, and track your savings.
        </p>
      </div>

      {/* Current Bill Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current Bill</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
          border border-gray-100 dark:border-gray-700/50 p-6">
          
          {/* Bill Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <div className="mb-4 sm:mb-0">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {currentBill.month} {currentBill.year}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                {getStatusIcon(currentBill.status)}
                <Badge variant={currentBill.status}>
                  {currentBill.status.charAt(0).toUpperCase() + currentBill.status.slice(1)}
                </Badge>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(currentBill.amount)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Due {formatDate(currentBill.dueDate)}
              </div>
            </div>
          </div>

          {/* Bill Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500 dark:bg-blue-600 rounded-lg">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Energy Usage</p>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    {currentBill.usage.toLocaleString()} kWh
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500 dark:bg-green-600 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Savings</p>
                  <p className="text-lg font-bold text-green-900 dark:text-green-100">
                    {formatCurrency(currentBill.savings)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500 dark:bg-purple-600 rounded-lg">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Payment Method</p>
                  <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {currentBill.paymentMethod}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button className="flex items-center justify-center space-x-2 px-6 py-3 
              bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700
              text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 
              hover:shadow-xl hover:shadow-blue-500/30 transform hover:scale-[1.02] active:scale-[0.98]">
              <Eye className="h-5 w-5" />
              <span>View Details</span>
            </button>
            
            <button className="flex items-center justify-center space-x-2 px-6 py-3 
              bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 
              text-gray-700 dark:text-gray-300 font-medium rounded-xl 
              hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200">
              <Download className="h-5 w-5" />
              <span>Download PDF</span>
            </button>
            
            {currentBill.status === 'pending' && (
              <button className="flex items-center justify-center space-x-2 px-6 py-3 
                bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl 
                transition-all duration-200 shadow-lg shadow-green-500/25 
                hover:shadow-xl hover:shadow-green-500/30 transform hover:scale-[1.02] active:scale-[0.98]">
                <DollarSign className="h-5 w-5" />
                <span>Pay Now</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Billing History</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
          border border-gray-100 dark:border-gray-700/50 overflow-hidden">
          
          {/* Table Header */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              <div>Period</div>
              <div>Amount</div>
              <div className="hidden md:block">Usage</div>
              <div className="hidden md:block">Savings</div>
              <div className="hidden md:block">Status</div>
              <div>Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {billHistory.map((bill) => (
              <div key={bill.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {bill.month} {bill.year}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Due: {formatDate(bill.dueDate)}
                    </div>
                  </div>
                  
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(bill.amount)}
                  </div>
                  
                  <div className="hidden md:block text-gray-600 dark:text-gray-400">
                    {bill.usage.toLocaleString()} kWh
                  </div>
                  
                  <div className="hidden md:block text-green-600 dark:text-green-400 font-medium">
                    {formatCurrency(bill.savings)}
                  </div>
                  
                  <div className="hidden md:block">
                    <Badge variant={bill.status}>
                      {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 
                      hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 
                      hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all duration-200">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Methods & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
          border border-gray-100 dark:border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Visa •••• 4567</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Auto-pay enabled</p>
                </div>
              </div>
              <Badge variant="success">Primary</Badge>
            </div>
            
            <button className="w-full p-4 border-2 border-dashed border-gray-200 dark:border-gray-600 
              rounded-xl text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600 
              hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200">
              + Add Payment Method
            </button>
          </div>
        </div>

        {/* Yearly Summary */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 
          rounded-2xl border border-green-100/50 dark:border-green-800/50 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">2024 Summary</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(6267.66)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total Savings</span>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(1011.79)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total Usage</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                15,322 kWh
              </span>
            </div>
            
            <div className="pt-4 border-t border-green-200 dark:border-green-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You saved <span className="font-semibold text-green-600 dark:text-green-400">16.1%</span> compared 
                to traditional energy providers this year.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 