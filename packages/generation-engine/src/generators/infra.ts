import type { GraphNode } from '@genesis-1/shared';

export interface InfraGenOptions {
  platform: 'docker' | 'kubernetes' | 'terraform';
  cloud?: 'aws' | 'gcp' | 'azure';
}

export class InfraGenerator {
  generate(nodes: GraphNode[], options: InfraGenOptions) {
    const infraNodes = nodes.filter((n) =>
      ['environment', 'region', 'cluster', 'namespace', 'container', 'pod', 'load_balancer'].includes(n.type),
    );

    const modules: Array<{ type: 'docker' | 'config'; path: string; content: string }> = [];

    if (options.platform === 'docker') {
      modules.push({
        type: 'docker',
        path: 'docker-compose.yml',
        content: '',
      });
    }

    if (options.platform === 'kubernetes') {
      for (const node of infraNodes.filter((n) => n.type === 'container' || n.type === 'service')) {
        modules.push({
          type: 'config',
          path: `k8s/${node.name.toLowerCase().replace(/\s+/g, '-')}-deployment.yaml`,
          content: '',
        });
      }
    }

    return modules;
  }
}
