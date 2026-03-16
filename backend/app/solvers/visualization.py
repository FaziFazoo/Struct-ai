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
        Generates individual plot layers: Deflection, Shear, Moment, Stress.
        Returns a dictionary of base64-encoded PNG strings.
        """
        x = results['x']
        sfd = results['sfd']
        bmd = results['bmd']
        deflection = [d * 1000 for d in results['deflection']]  # Convert to mm
        stress = [s / 1e6 for s in results['bending_stress']]   # Convert to MPa

        plt.style.use('dark_background')
        layers = {}

        plot_configs = [
            ('deflection', x, deflection, '#00d2ff', 'Beam Deflection', 'Deflection (mm)', 'Position (m)'),
            ('shear',      x, sfd,        '#ff4757', 'Shear Force (SFD)', 'Force (N)', 'Position (m)'),
            ('moment',     x, bmd,        '#2ed573', 'Bending Moment (BMD)', 'Moment (N·m)', 'Position (m)'),
            ('stress',     x, stress,     '#a55eea', 'Bending Stress', 'Stress (MPa)', 'Position (m)'),
        ]

        for key, px, py, color, title, ylabel, xlabel in plot_configs:
            fig, ax = plt.subplots(figsize=(10, 6))
            fig.patch.set_facecolor('#0a0a0f')
            ax.set_facecolor('#0d0d14')
            
            ax.plot(px, py, color=color, linewidth=2.5)
            ax.fill_between(px, py, color=color, alpha=0.1)
            
            ax.set_title(f'S.T.R.U.C.T — {title}', color='#00d2ff', fontsize=12, pad=15, fontweight='bold')
            ax.set_ylabel(ylabel, color='#888899', fontsize=10)
            ax.set_xlabel(xlabel, color='#888899', fontsize=10)
            
            ax.tick_params(colors='#555566', labelsize=9)
            ax.spines[:].set_color('#222233')
            ax.grid(True, color='#1a1a2e', linewidth=0.5, linestyle='--')
            
            plt.tight_layout()

            # Encode to base64
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=120, bbox_inches='tight', facecolor=fig.get_facecolor())
            buf.seek(0)
            layers[key] = base64.b64encode(buf.read()).decode('utf-8')
            plt.close(fig)

        return layers
