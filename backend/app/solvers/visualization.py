"""
Visualization engine for S.T.R.U.C.T.
Generates SFD, BMD, and Deflection plots using Matplotlib.
Returns base64-encoded PNG for direct browser rendering.
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import os
import uuid
import io
import base64

class VisualizationEngine:
    def __init__(self, output_dir="static/plots"):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
    def generate_plots(self, results):
        """
        Creates 4 subplots: Deflection, Shear, Moment, Stress.
        Returns base64-encoded PNG string instead of a file path.
        """
        x = results['x']
        sfd = results['sfd']
        bmd = results['bmd']
        deflection = [d * 1000 for d in results['deflection']]  # Convert to mm
        stress = [s / 1e6 for s in results['bending_stress']]   # Convert to MPa

        plt.style.use('dark_background')
        fig, axs = plt.subplots(2, 2, figsize=(12, 10))
        fig.patch.set_facecolor('#0a0a0f')
        fig.suptitle('S.T.R.U.C.T — Structural Analysis Results', fontsize=14,
                     color='#00d2ff', fontweight='bold')

        plot_configs = [
            (axs[0, 0], x, deflection, '#00d2ff', 'Beam Deflection', 'Deflection (mm)', None),
            (axs[0, 1], x, sfd,        '#ff4757', 'Shear Force Diagram (SFD)', 'Force (N)', None),
            (axs[1, 0], x, bmd,        '#2ed573', 'Bending Moment Diagram (BMD)', 'Moment (N·m)', 'Position along beam (m)'),
            (axs[1, 1], x, stress,     '#a55eea', 'Bending Stress Distribution', 'Stress (MPa)', 'Position along beam (m)'),
        ]
        for ax, px, py, color, title, ylabel, xlabel in plot_configs:
            ax.set_facecolor('#0d0d14')
            ax.plot(px, py, color=color, linewidth=2)
            ax.fill_between(px, py, color=color, alpha=0.08)
            ax.set_title(title, color='#aaaacc', fontsize=10, pad=8)
            ax.set_ylabel(ylabel, color='#888899', fontsize=8)
            if xlabel:
                ax.set_xlabel(xlabel, color='#888899', fontsize=8)
            ax.tick_params(colors='#555566')
            ax.spines[:].set_color('#222233')
            ax.grid(True, color='#1a1a2e', linewidth=0.5)

        plt.tight_layout(rect=[0, 0.03, 1, 0.94])

        # --- Encode to base64 for direct frontend rendering ---
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight',
                    facecolor=fig.get_facecolor())
        buf.seek(0)
        plot_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)

        return plot_base64
