import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, TrendingDown, Zap, DollarSign, Activity, Calendar, ChevronRight, Leaf } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();

  // Mock data for the customer dashboard
  const energyData = {
    currentUsage: 1245,
    lastMonthUsage: 1387,
    savingsThisMonth: 342.50,
    totalSavings: 2456.78,
    efficiency: 87,
    carbonOffset: 145
  };

  const usageTrend = energyData.currentUsage < energyData.lastMonthUsage;
  const percentageChange = Math.abs(((energyData.currentUsage - energyData.lastMonthUsage) / energyData.lastMonthUsage) * 100);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            ¡Bienvenido de nuevo, {user?.name?.split(' ')[0] || 'Cliente'}!
          </h1>
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Calendar size={16} />
            <span>{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Aquí tienes tu resumen de energía y ahorros para este mes.
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Current Energy Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
          border border-gray-100 dark:border-gray-700/50 p-6 transition-all duration-200 hover:shadow-xl 
          hover:shadow-gray-200/50 dark:hover:shadow-gray-900/80 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-400/10 dark:to-blue-500/10 rounded-xl">
              <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
              usageTrend 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}>
              {usageTrend ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              <span>{percentageChange.toFixed(1)}%</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {energyData.currentUsage.toLocaleString()} kWh
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Uso del mes actual</p>
          </div>
        </div>

        {/* Monthly Savings */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
          border border-gray-100 dark:border-gray-700/50 p-6 transition-all duration-200 hover:shadow-xl 
          hover:shadow-gray-200/50 dark:hover:shadow-gray-900/80 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-400/10 dark:to-green-500/10 rounded-xl">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium 
              bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              <TrendingUp size={12} />
              <span>+12%</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${energyData.savingsThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Ahorros este mes</p>
          </div>
        </div>

        {/* Energy Efficiency */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
          border border-gray-100 dark:border-gray-700/50 p-6 transition-all duration-200 hover:shadow-xl 
          hover:shadow-gray-200/50 dark:hover:shadow-gray-900/80 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-400/10 dark:to-purple-500/10 rounded-xl">
              <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium 
              bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
              <span>Excelente</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {energyData.efficiency}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Puntuación de eficiencia</p>
          </div>
        </div>

        {/* Carbon Offset */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
          border border-gray-100 dark:border-gray-700/50 p-6 transition-all duration-200 hover:shadow-xl 
          hover:shadow-gray-200/50 dark:hover:shadow-gray-900/80 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 dark:from-emerald-400/10 dark:to-emerald-500/10 rounded-xl">
              <Leaf className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium 
              bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <TrendingUp size={12} />
              <span>+8%</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {energyData.carbonOffset} lbs
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Compensación CO₂ este mes</p>
          </div>
        </div>
      </div>

      {/* Quick Actions and Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Energy Usage Chart Placeholder */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
          border border-gray-100 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tendencia de Uso Energético</h3>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 
              transition-colors font-medium">Ver Detalles</button>
          </div>
          <div className="h-64 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 
            rounded-xl flex items-center justify-center">
            <div className="text-center">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Gráfico interactivo próximamente</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Rastrea tu uso de energía a lo largo del tiempo</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
            border border-gray-100 dark:border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Acciones Rápidas</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 
                transition-all duration-200 group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Ver Detalles de Uso</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </button>
              
              <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 
                transition-all duration-200 group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Descargar Factura</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </button>
              
              <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 
                transition-all duration-200 group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Consejos de Energía</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </button>
            </div>
          </div>

          {/* Savings Summary */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 
            rounded-2xl border border-green-100/50 dark:border-green-800/50 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-green-500 dark:bg-green-600 rounded-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ahorros Totales</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                  ${energyData.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">Desde que te uniste al Portal de Energía</p>
              </div>
              <div className="pt-3 border-t border-green-200 dark:border-green-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Estás ahorrando un <span className="font-semibold text-green-700 dark:text-green-400">14%</span> comparado con proveedores de energía tradicionales.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Alerts/Notifications */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-100/50 dark:shadow-gray-900/50 
        border border-gray-100 dark:border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actualizaciones Recientes</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
            <div className="p-2 bg-blue-500 dark:bg-blue-600 rounded-lg flex-shrink-0">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Alerta de Pico de Uso</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Tu uso de energía fue 15% mayor que lo habitual el 10 de diciembre entre 6-8 PM.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">hace 2 horas</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/50">
            <div className="p-2 bg-green-500 dark:bg-green-600 rounded-lg flex-shrink-0">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Factura Mensual Lista</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Tu factura de diciembre está lista para revisar. ¡Ahorraste $42 este mes!
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">hace 1 día</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 