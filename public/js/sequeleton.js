// Função para gerar skeleton loading de tabelas
function generateTableSkeleton(columns, rows = 5) {
    const skeletonRows = [];
    
    for (let i = 0; i < rows; i++) {
        const cells = columns.map(col => {
            switch (col.type) {
                case 'avatar-text':
                    return `
                        <td class="skeleton-cell">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="skeleton skeleton-avatar"></div>
                                <div class="skeleton skeleton-text medium"></div>
                            </div>
                        </td>
                    `;
                case 'badge':
                    return `<td class="skeleton-cell"><div class="skeleton skeleton-badge"></div></td>`;
                case 'buttons':
                    return `
                        <td class="skeleton-cell">
                            <div style="display: flex; gap: 8px;">
                                <div class="skeleton skeleton-button"></div>
                                <div class="skeleton skeleton-button"></div>
                            </div>
                        </td>
                    `;
                case 'text-short':
                    return `<td class="skeleton-cell"><div class="skeleton skeleton-text short"></div></td>`;
                case 'text-medium':
                    return `<td class="skeleton-cell"><div class="skeleton skeleton-text medium"></div></td>`;
                default:
                    return `<td class="skeleton-cell"><div class="skeleton skeleton-text long"></div></td>`;
            }
        }).join('');
        
        skeletonRows.push(`<tr class="skeleton-row">${cells}</tr>`);
    }
    
    return skeletonRows.join('');
}