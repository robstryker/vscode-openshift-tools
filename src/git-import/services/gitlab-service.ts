/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Gitlab } from 'gitlab';
import i18n from 'i18next';
import {
  GitSource,
  SecretType,
  RepoMetadata,
  BranchList,
  RepoLanguageList,
  RepoFileList,
  RepoStatus,
  Response
} from '../types';
import { BaseService } from './base-service';
import GitUrlParse = require('git-url-parse');
import { getVscodeModule } from '../../util/credentialManager';
const Base64:any = getVscodeModule('js-base64');

type GitlabRepo = {
  id: number;
  path_with_namespace: string;
};

const removeLeadingSlash = (str: string) => str?.replace(/^\//, '') || '';

export class GitlabService extends BaseService {
  private readonly client: any;

  private readonly metadata: RepoMetadata;

  private repo: GitlabRepo;

  constructor(gitsource: GitSource) {
    super(gitsource);
    this.metadata = this.getRepoMetadata();
    const token = this.getAuthProvider();
    this.client = new Gitlab({
      host: this.metadata.host,
      token,
    });
    this.repo = null;
  }

  private getRepo = async (): Promise<GitlabRepo> => {
    if (this.repo) {
      return Promise.resolve(this.repo);
    }
    const repo: GitlabRepo = await this.client.Projects.show(this.metadata.fullName);
    if (!repo) {
      throw new Error(i18n.t('git-service~Unable to find repository'));
    } else if (repo.path_with_namespace !== this.metadata.fullName) {
      throw new Error(
        i18n.t('git-service~Repository path {{path}} does not match expected name {{name}}', {
          path: repo.path_with_namespace,
          name: this.metadata.fullName,
        }),
      );
    }

    this.repo = repo;
    return Promise.resolve(this.repo);
  };

  getRepoMetadata(): RepoMetadata {
    const { name, owner, resource, full_name: fullName } = GitUrlParse(this.gitsource.url);
    const contextDir = removeLeadingSlash(this.gitsource.contextDir);
    const host = `https://${resource}`;
    return {
      repoName: name,
      owner,
      host,
      defaultBranch: this.gitsource.ref,
      fullName,
      contextDir,
      devfilePath: this.gitsource.devfilePath,
      dockerfilePath: this.gitsource.dockerfilePath,
    };
  }

  getAuthProvider = (): any => {
    switch (this.gitsource.secretType) {
      case SecretType.PERSONAL_ACCESS_TOKEN:
      case SecretType.OAUTH:
      case SecretType.BASIC_AUTH:
        return Base64.decode(this.gitsource.secretContent.password);
      default:
        return null;
    }
  };

  getProjectId = async (): Promise<any> => {
    // eslint-disable-next-line no-useless-catch
    try {
      const repo = await this.getRepo();
      return repo.id;
    } catch (e) {
      throw e;
    }
  };

  isRepoReachable = async (): Promise<RepoStatus> => {
    try {
      await this.getRepo();
      return RepoStatus.Reachable;
    } catch (e) {
      if (e.response?.status === 429) {
        return RepoStatus.RateLimitExceeded;
      }
    }
    return RepoStatus.Unreachable;
  };

  getRepoBranchList = async (): Promise<BranchList> => {
    try {
      const projectID = await this.getProjectId();
      const resp = await this.client.Branches.all(projectID);
      const list = resp.map((b) => b.name);
      return { branches: list };
    } catch (e) {
      return { branches: [] };
    }
  };

  getRepoFileList = async (): Promise<RepoFileList> => {
    try {
      const projectID = await this.getProjectId();
      const resp = await this.client.Repositories.tree(projectID, {
        path: this.metadata.contextDir,
      });
      const files = resp.reduce((acc, file) => {
        if (file.type === 'blob') acc.push(file.path);
        return acc;
      }, []);
      return { files };
    } catch (e) {
      return { files: [] };
    }
  };

  getRepoLanguageList = async (): Promise<RepoLanguageList> => {
    try {
      const projectID = await this.getProjectId();
      const resp = await this.client.Projects.languages(projectID);
      return { languages: Object.keys(resp) };
    } catch (e) {
      return { languages: [] };
    }
  };

  isFilePresent = async (path: string): Promise<Response> => {
    try {
      const projectID = await this.getProjectId();
      const ref = this.metadata.defaultBranch || (this.repo as any)?.default_branch;
      await this.client.RepositoryFiles.showRaw(projectID, path, ref);
      return {status: true};
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return {status: false, error: e};
    }
  };

  getFileContent = async (path: string): Promise<string | null> => {
    try {
      const projectID = await this.getProjectId();
      const ref = this.metadata.defaultBranch || (this.repo as any)?.default_branch;
      return await this.client.RepositoryFiles.showRaw(projectID, path, ref);
    } catch (e) {
      return null;
    }
  };

  filePath = (file: string): string => {
    return this.metadata.contextDir ? `${this.metadata.contextDir}/${file}` : file;
  };

  isDockerfilePresent = () => this.isFilePresent(this.filePath(`${this.metadata.dockerfilePath}`));

  getDockerfileContent = () =>
    this.getFileContent(this.filePath(`${this.metadata.dockerfilePath}`));

  isDevfilePresent = () => this.isFilePresent(this.filePath(`${this.metadata.devfilePath}`));

  getDevfileContent = () => this.getFileContent(this.filePath(`${this.metadata.devfilePath}`));

  getPackageJsonContent = () => this.getFileContent(this.filePath('package.json'));
}
