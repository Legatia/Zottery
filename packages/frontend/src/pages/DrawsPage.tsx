import { useEffect, useState } from 'react';
import { api } from '../services/api';
import './DrawsPage.css';

interface Draw {
  drawId: number;
  status: string;
  salesCloseDate: string;
  drawDate: string;
  ticketsSold: number;
  prizePool: number;
  winningNumbers?: number[];
  prizesDistributed?: any;
}

export default function DrawsPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDraws();
  }, []);

  const loadDraws = async () => {
    try {
      setLoading(true);
      const response = await api.getAllDraws(20, 0);
      if (response.success && response.draws) {
        setDraws(response.draws);
      } else {
        setError('Failed to load draws');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatZEC = (amount: number) => {
    return `${amount.toFixed(4)} ZEC`;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      open: 'success',
      closed: 'warning',
      drawn: 'primary',
      completed: 'primary',
    };
    return statusMap[status] || 'primary';
  };

  return (
    <div className="draws-page">
      <div className="page-header">
        <h1>Past Draws</h1>
        <p>View results from previous lottery draws</p>
      </div>

      {loading && (
        <div className="center">
          <div className="loading"></div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {!loading && draws.length === 0 && (
        <div className="alert alert-info">
          No draws available yet. Check back soon!
        </div>
      )}

      <div className="draws-list">
        {draws.map((draw) => (
          <div key={draw.drawId} className="draw-card">
            <div className="draw-header">
              <h2>Draw #{draw.drawId}</h2>
              <span className={`badge badge-${getStatusBadge(draw.status)}`}>
                {draw.status.toUpperCase()}
              </span>
            </div>

            <div className="draw-details">
              <div className="detail-row">
                <span className="detail-label">Prize Pool:</span>
                <span className="detail-value prize-pool">
                  {formatZEC(draw.prizePool)}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Tickets Sold:</span>
                <span className="detail-value">{draw.ticketsSold}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Sales Closed:</span>
                <span className="detail-value">{formatDate(draw.salesCloseDate)}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Draw Date:</span>
                <span className="detail-value">{formatDate(draw.drawDate)}</span>
              </div>
            </div>

            {draw.winningNumbers && draw.winningNumbers.length > 0 && (
              <div className="winning-section">
                <h3>Winning Numbers</h3>
                <div className="winning-numbers">
                  {draw.winningNumbers.map((num, idx) => (
                    <span key={idx} className="winning-ball">{num}</span>
                  ))}
                </div>
              </div>
            )}

            {draw.prizesDistributed && (
              <div className="prizes-section">
                <h3>Prize Distribution</h3>
                <div className="prizes-grid">
                  {draw.prizesDistributed.match6?.winners > 0 && (
                    <div className="prize-item">
                      <span className="prize-tier">6/6 Matches</span>
                      <span className="prize-winners">
                        {draw.prizesDistributed.match6.winners} winner(s)
                      </span>
                      <span className="prize-amount">
                        {formatZEC(draw.prizesDistributed.match6.amountEach)} each
                      </span>
                    </div>
                  )}

                  {draw.prizesDistributed.match5?.winners > 0 && (
                    <div className="prize-item">
                      <span className="prize-tier">5/6 Matches</span>
                      <span className="prize-winners">
                        {draw.prizesDistributed.match5.winners} winner(s)
                      </span>
                      <span className="prize-amount">
                        {formatZEC(draw.prizesDistributed.match5.amountEach)} each
                      </span>
                    </div>
                  )}

                  {draw.prizesDistributed.match4?.winners > 0 && (
                    <div className="prize-item">
                      <span className="prize-tier">4/6 Matches</span>
                      <span className="prize-winners">
                        {draw.prizesDistributed.match4.winners} winner(s)
                      </span>
                      <span className="prize-amount">
                        {formatZEC(draw.prizesDistributed.match4.amountEach)} each
                      </span>
                    </div>
                  )}

                  {draw.prizesDistributed.match3?.winners > 0 && (
                    <div className="prize-item">
                      <span className="prize-tier">3/6 Matches</span>
                      <span className="prize-winners">
                        {draw.prizesDistributed.match3.winners} winner(s)
                      </span>
                      <span className="prize-amount">
                        {formatZEC(draw.prizesDistributed.match3.amountEach)} each
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
