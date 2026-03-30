import React from "react";
import "./Stats.css";

export default function Stats() {
  const statsData = [
    {
      id: 1,
      label: "Funcionários Ativos",
      value: "10.2k",
      trend: "+12.5%",
      trendText: "vs. mês anterior",
      isPositive: true,
      colorTheme: "blue",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
    },
    {
      id: 2,
      label: "Taxa de Retenção",
      value: "94.3%",
      trend: "+5.2%",
      trendText: "vs. mês anterior",
      isPositive: true,
      colorTheme: "green",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
    },
    {
      id: 3,
      label: "Tempo Médio de Contratação",
      value: "2.4h",
      trend: "-18.3%",
      trendText: "vs. mês anterior",
      isPositive: false,
      colorTheme: "purple",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
    },
    {
      id: 4,
      label: "Metas Alcançadas",
      value: "87%",
      trend: "+23.1%",
      trendText: "vs. mês anterior",
      isPositive: true,
      colorTheme: "orange",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
      ),
    },
  ];

  return (
    <section className="stats-section">
      <div className="stats-header">
        <h2>Resultados que Falam por Si</h2>
        <p>Dados em tempo real para decisões mais inteligentes</p>
      </div>

      <div className="stats-grid">
        {statsData.map((stat) => (
          <div key={stat.id} className="stat-card">
            
            <div className={`stat-icon-wrapper ${stat.colorTheme}`}>
              {stat.icon}
            </div>

            <div className="stat-content">
              <p className="stat-label-text">{stat.label}</p>
              <h3 className="stat-value">{stat.value}</h3>

              <div className="stat-trend">
                <span
                  className={`trend-badge ${
                    stat.isPositive ? "positive" : "negative"
                  }`}
                >
                  {stat.trend}
                </span>
                <span className="trend-text">{stat.trendText}</span>
              </div>
            </div>

          </div>
        ))}
      </div>
    </section>
  );
}